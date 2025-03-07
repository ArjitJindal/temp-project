import { GetObjectCommand } from '@aws-sdk/client-s3'
import { random } from 'lodash'
import { sendWebhookTasks } from '../webhook/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillWebhookDeliveries } from '@/@types/batch-job'
import { getS3Client } from '@/utils/s3'
import { CRARiskLevelUpdatedDetails } from '@/@types/openapi-public/CRARiskLevelUpdatedDetails'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { logger } from '@/core/logger'

type RiskLevelStatus = 'HC' | 'HI' | 'MI' | 'MC' | 'L'

export class PnbBackfillWebhookDeliveriesBatchJobRunner extends BatchJobRunner {
  protected async run(job: PnbBackfillWebhookDeliveries) {
    const { s3Key } = job.parameters
    const s3 = getS3Client()
    const { Body } = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.IMPORT_BUCKET,
        Key: s3Key,
      })
    )

    const string = await Body?.transformToString()

    if (!string) {
      throw new Error('No string found in s3 object')
    }

    const lines = string.split('\n')
    const data: {
      userId: string
      riskLevelStatus: 'HC' | 'HI' | 'MI' | 'MC' | 'L'
    }[] = []
    for (const line of lines) {
      const [id, _, riskLevelStatus] = line.split('|')

      data.push({
        userId: id,
        riskLevelStatus: riskLevelStatus as RiskLevelStatus,
      })
    }

    let count = 0
    for await (const item of data) {
      let riskLevel: RiskLevel = 'VERY_LOW'
      /**
       * L = VERY LOW
       * MC = LOW
       * HC = MEDIUM
       * MI = HIGH
       * HI = VERY_HIGH
       */
      switch (item.riskLevelStatus) {
        case 'HC':
          riskLevel = 'MEDIUM'
          break
        case 'MI':
          riskLevel = 'HIGH'
          break
        case 'HI':
          riskLevel = 'VERY_HIGH'
          break
        case 'L':
          riskLevel = 'VERY_LOW'
          break
        case 'MC':
          riskLevel = 'LOW'
          break
      }

      await sendWebhookTasks<CRARiskLevelUpdatedDetails>(job.tenantId, [
        {
          event: 'CRA_RISK_LEVEL_UPDATED',
          entityId: item.userId,
          payload: {
            riskLevel,
            userId: item.userId,
          },
          triggeredBy: 'SYSTEM',
        },
      ])

      count++
      logger.warn(
        `Sent user ${item.userId} for risk level ${riskLevel} (${count} of ${data.length})`
      )
      await new Promise((resolve) => setTimeout(resolve, random(500, 5000)))
    }
  }
}
