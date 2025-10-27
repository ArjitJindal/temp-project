import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { DYNAMODB_TABLE_NAMES } from '@lib/constants'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getSecret } from '@/utils/secrets-manager'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

// Environment variables - validated at runtime
const getEnvVar = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const PARQUET_S3_BUCKET_NAME = getEnvVar('PARQUET_S3_BUCKET_NAME')
const POSTHOG_ACCESS_KEY_SECRET_ARN = getEnvVar('POSTHOG_ACCESS_KEY_SECRET_ARN')
const POSTHOG_SECRET_KEY_SECRET_ARN = getEnvVar('POSTHOG_SECRET_KEY_SECRET_ARN')

/**
 * Get the last synced timestamp from DynamoDB
 */
async function getLastSyncedTimestamp(): Promise<number> {
  const dynamoDb = getDynamoDbClient()

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: DYNAMODB_TABLE_NAMES.TARPON,
        Key: DynamoDbKeys.CLOUDWATCH_LOGS_SYNC_STATE(),
      })
    )

    if (result.Item?.last_synced_timestamp) {
      return result.Item.last_synced_timestamp as number
    }

    // Default to 0 (epoch) if no previous sync
    return 0
  } catch (error) {
    logger.error('Error reading last synced timestamp from DynamoDB', { error })
    throw error
  }
}

/**
 * Update the last synced timestamp in DynamoDB
 */
async function updateLastSyncedTimestamp(timestamp: number): Promise<void> {
  const dynamoDb = getDynamoDbClient()

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: DYNAMODB_TABLE_NAMES.TARPON,
        Item: {
          ...DynamoDbKeys.CLOUDWATCH_LOGS_SYNC_STATE(),
          last_synced_timestamp: timestamp,
          updated_at: Date.now(),
        },
      })
    )

    logger.info('Updated last synced timestamp in DynamoDB', { timestamp })
  } catch (error) {
    logger.error('Error updating last synced timestamp in DynamoDB', { error })
    throw error
  }
}

/**
 * Get S3 credentials from Secrets Manager (eu-central-1)
 * Uses the shared getSecret utility which handles cross-region secrets
 */
async function getS3Credentials(): Promise<{
  accessKeyId: string
  secretAccessKey: string
}> {
  try {
    const [accessKeyId, secretAccessKey] = await Promise.all([
      getSecret<string>(POSTHOG_ACCESS_KEY_SECRET_ARN),
      getSecret<string>(POSTHOG_SECRET_KEY_SECRET_ARN),
    ])

    return { accessKeyId, secretAccessKey }
  } catch (error) {
    logger.error('Error retrieving S3 credentials from Secrets Manager', {
      error,
    })
    throw error
  }
}

/**
 * Export CloudWatch logs from ClickHouse to S3 Parquet
 */
export const handleCloudwatchLogsS3Export = async () => {
  const startTime = Date.now()

  try {
    logger.info('Starting CloudWatch logs S3 Parquet export')

    const lastSyncedTimestamp = await getLastSyncedTimestamp()
    logger.info('Retrieved last synced timestamp', {
      lastSyncedTimestamp,
      lastSyncedDate: new Date(lastSyncedTimestamp).toISOString(),
    })

    const { accessKeyId, secretAccessKey } = await getS3Credentials()

    const clickhouseClient = await getClickhouseClient('default')

    const timestamp = Date.now()
    const region = process.env.AWS_REGION || 'unknown-region'
    const filename = `log_${region}_${timestamp}.parquet`

    // S3 bucket is always in eu-central-1 (centralized for all regions)
    const s3Url = `https://${PARQUET_S3_BUCKET_NAME}.s3.eu-central-1.amazonaws.com/${filename}`

    logger.info('Preparing to export to S3', {
      s3Url,
      filename,
      lastSyncedTimestamp,
    })

    const statsQuery = `
      SELECT 
        count() as count,
        max(toUnixTimestamp64Milli(requestEndTimestamp)) as maxTimestamp
      FROM ${CLICKHOUSE_DEFINITIONS.CLOUDWATCH_LOGS_CORRELATED.tableName}
      WHERE requestEndTimestamp > fromUnixTimestamp64Milli(${lastSyncedTimestamp})
    `

    const statsResult = await clickhouseClient.query({
      query: statsQuery,
      format: 'JSONEachRow',
    })

    const statsData = await statsResult.json<{
      count: string
      maxTimestamp: string
    }>()
    const recordCount = parseInt(statsData[0]?.count || '0', 10)
    const newMaxTimestamp = parseInt(statsData[0]?.maxTimestamp || '0', 10)

    if (recordCount === 0) {
      logger.info('No new records to export', {
        lastSyncedTimestamp,
        executionTime: Date.now() - startTime,
      })
      return
    }

    logger.info('Found new records to export', {
      recordCount,
      lastSyncedTimestamp,
      newMaxTimestamp,
      newMaxTimestampDate: new Date(newMaxTimestamp).toISOString(),
    })

    const exportQuery = `
      INSERT INTO FUNCTION s3(
        '${s3Url}',
        '${accessKeyId}',
        '${secretAccessKey}',
        'Parquet'
      )
      SELECT 
        requestId,
        requestStartTimestamp,
        requestEndTimestamp,
        tenantId,
        duration,
        billedDuration,
        memorySize,
        maxMemoryUsed,
        initDuration,
        logGroup,
        logStream,
        xrayTraceId,
        httpMethod,
        resource,
        entityId,
        '${process.env.AWS_REGION}' as region
      FROM ${CLICKHOUSE_DEFINITIONS.CLOUDWATCH_LOGS_CORRELATED.tableName}
      WHERE requestEndTimestamp > fromUnixTimestamp64Milli(${lastSyncedTimestamp})
        AND requestEndTimestamp <= fromUnixTimestamp64Milli(${newMaxTimestamp})
      ORDER BY requestEndTimestamp
    `

    logger.info('Executing S3 export query', {
      recordCount,
      s3Url,
      lastSyncedTimestamp,
      newMaxTimestamp,
      timeRange: {
        from: new Date(lastSyncedTimestamp).toISOString(),
        to: new Date(newMaxTimestamp).toISOString(),
      },
    })

    await clickhouseClient.command({
      query: exportQuery,
    })

    logger.info('Successfully exported data to S3 Parquet', {
      recordCount,
      s3Url,
      filename,
    })

    await updateLastSyncedTimestamp(newMaxTimestamp)
    logger.info('Updated sync state', {
      oldTimestamp: lastSyncedTimestamp,
      newTimestamp: newMaxTimestamp,
    })

    const executionTime = Date.now() - startTime

    logger.info('CloudWatch logs S3 Parquet export completed successfully', {
      recordCount,
      filename,
      s3Url,
      executionTime,
      lastSyncedTimestamp,
      newMaxTimestamp,
    })
  } catch (error) {
    logger.error('Error exporting CloudWatch logs to S3 Parquet', {
      error,
      executionTime: Date.now() - startTime,
    })
    throw error
  }
}

export const cloudwatchLogsS3ExporterHandler = lambdaConsumer()(
  handleCloudwatchLogsS3Export
)
