import { PassThrough } from 'stream'
import { ClickHouseClient } from '@clickhouse/client'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { WebClient } from '@slack/web-api'
import { stageAndRegion } from '@flagright/lib/utils'
import slackify from 'slackify-markdown'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbPullUsersData } from '@/@types/batch-job'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { getSecret } from '@/utils/secrets-manager'
import {
  ENGINEERING_HELP_CHANNEL_ID,
  ENGINEERING_ON_CALL_GROUP_ID,
  QA_GROUP_ID,
} from '@/utils/slack'

type ExtractedData = {
  userId: string
  krsScore: number
  avgArsScore: number
  craScore: number
  riskLevel: string
}

export class PnbPullUsersDataBatchJobRunner extends BatchJobRunner {
  private s3Client: S3Client
  private totalRows = 0

  constructor(jobId: string) {
    super(jobId)
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    })
  }

  protected async run(job: PnbPullUsersData): Promise<void> {
    const { tenantId } = job
    const dynamoDb = getDynamoDbClient()
    const clickhouseClient = await getClickhouseClient(tenantId)
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
    })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    try {
      const s3Data = await this.streamToS3(
        clickhouseClient,
        riskClassificationValues,
        tenantId
      )

      // alert in the slack channel
      await this.sendSlackAlert(tenantId, s3Data)
    } catch (error) {
      await this.sendSlackErrorAlert(tenantId, error as Error)
    }
  }

  private async sendSlackMessage(message: string): Promise<void> {
    const slackCreds = await getSecret<{ token: string }>('slackCreds')
    const slackClient = new WebClient(slackCreds.token)
    await slackClient.chat.postMessage({
      channel: ENGINEERING_HELP_CHANNEL_ID,
      text: slackify(message),
    })
  }

  private async sendSlackAlert(
    tenantId: string,
    s3Data: {
      bucket: string
      key: string
    }
  ): Promise<void> {
    const [stage, region] = stageAndRegion()
    await this.sendSlackMessage(
      `<!subteam^${ENGINEERING_ON_CALL_GROUP_ID}> Tenant ${tenantId} has finished processing. S3 data: \`${s3Data.bucket}/${s3Data.key}\` in env \`${stage}\` and region \`${region}\` Please help ${QA_GROUP_ID} to extract the data and send it to the customer`
    )
  }

  private async sendSlackErrorAlert(
    tenantId: string,
    error: Error
  ): Promise<void> {
    await this.sendSlackMessage(
      `<!subteam^${ENGINEERING_ON_CALL_GROUP_ID}> Tenant ${tenantId} has failed to process. Error: ${error.message}`
    )
  }

  private async getCount(clickhouseClient: ClickHouseClient): Promise<number> {
    const query = `
    SELECT count() as count
    FROM users FINAL
    WHERE timestamp != 0
    `
    const result = await clickhouseClient.query({
      query,
      format: 'JSONEachRow',
    })
    const data = await result.json<{ count: number }>()
    return data[0].count
  }

  private async streamToS3(
    clickhouseClient: ClickHouseClient,
    riskClassificationValues: RiskClassificationScore[],
    tenantId: string
  ): Promise<{ bucket: string; key: string }> {
    const bucket = process.env.DOCUMENT_BUCKET
    if (!bucket) {
      throw new Error('DOCUMENT_BUCKET is not set')
    }

    const key = `exports/${tenantId}/${dayjs().format(
      'YYYY-MM-DD_HH-mm-ss'
    )}.csv`
    const query = this.buildQuery(riskClassificationValues)

    const result = await clickhouseClient.query({
      query,
      format: 'CSV',
    })

    const usersCount = await this.getCount(clickhouseClient)
    this.totalRows = usersCount
    logger.info(`Total rows: ${usersCount}`)

    const clickhouseStream = result.stream<ExtractedData>()
    const passThrough = new PassThrough() // Will act as Body for S3 upload

    // Write CSV header
    passThrough.write('UnitholderId,Risk Level,KRS,Average TRS,CRA\n')

    let count = 0
    const interval = setInterval(() => {
      const percentage = (count / usersCount) * 100
      logger.info(`Progress: ${percentage.toFixed(2)}%`)
    }, 1000)

    // Pipe ClickHouse data into PassThrough stream
    clickhouseStream.on('data', (rows) => {
      rows.forEach((row) => {
        count++
        passThrough.write(row.text + '\n')
      })
    })

    clickhouseStream.on('end', () => {
      clearInterval(interval)
      passThrough.end()
      logger.info('ClickHouse streaming finished.')
    })

    clickhouseStream.on('error', (err) => {
      clearInterval(interval)
      passThrough.destroy(err)
      logger.error('Stream error:', err)
    })

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: passThrough,
        ContentType: 'text/csv',
      },
      queueSize: 10,
      partSize: 5 * 1024 * 1024, // 5MB parts
    })

    upload.on('httpUploadProgress', (progress) => {
      logger.info(`Upload progress: ${JSON.stringify(progress, null, 2)}`)
    })

    await upload.done()

    logger.info('Upload finished.')

    return { bucket, key }
  }

  private buildQuery(
    riskClassificationValues: RiskClassificationScore[]
  ): string {
    const veryLowScoreThreshold = riskClassificationValues.find(
      (value) => value.riskLevel === 'VERY_LOW'
    )
    const lowScoreThreshold = riskClassificationValues.find(
      (value) => value.riskLevel === 'LOW'
    )
    const mediumScoreThreshold = riskClassificationValues.find(
      (value) => value.riskLevel === 'MEDIUM'
    )

    return `
    WITH
        IF(
            COALESCE(arrayFirst(x -> x.key = 'RISK_LEVEL_STATUS', tags).value, '') = '',
            'Complete',
            arrayFirst(x -> x.key = 'RISK_LEVEL_STATUS', tags).value
        ) AS riskStatus
    SELECT
        id AS userId,
        CASE
            WHEN drsScore_drsScore >= ${veryLowScoreThreshold?.lowerBoundRiskScore}
            AND drsScore_drsScore < ${veryLowScoreThreshold?.upperBoundRiskScore} THEN 'L'
            WHEN drsScore_drsScore >= ${lowScoreThreshold?.lowerBoundRiskScore}
            AND drsScore_drsScore < ${lowScoreThreshold?.upperBoundRiskScore}
            AND riskStatus = 'Complete' THEN 'MC'
            WHEN drsScore_drsScore >= ${lowScoreThreshold?.lowerBoundRiskScore}
            AND drsScore_drsScore < ${lowScoreThreshold?.upperBoundRiskScore}
            AND riskStatus = 'Incomplete' THEN 'MI'
            WHEN drsScore_drsScore >= ${mediumScoreThreshold?.lowerBoundRiskScore}
            AND drsScore_drsScore <= ${mediumScoreThreshold?.upperBoundRiskScore}
            AND riskStatus = 'Complete' THEN 'HC'
            WHEN drsScore_drsScore >= ${mediumScoreThreshold?.lowerBoundRiskScore}
            AND drsScore_drsScore <= ${mediumScoreThreshold?.upperBoundRiskScore}
            AND riskStatus = 'Incomplete' THEN 'HI'
            ELSE 'unknown'
        END AS riskLevel,
        krsScore_krsScore AS krsScore,
        JSONExtractFloat(data, 'avgArsScore', 'value') as avgArsScore,
        drsScore_drsScore AS craScore
    FROM
        users FINAL
    WHERE
        timestamp != 0
    `
  }
}
