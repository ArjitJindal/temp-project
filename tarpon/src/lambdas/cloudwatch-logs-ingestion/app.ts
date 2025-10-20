import { gunzipSync } from 'zlib'
import { S3Event } from 'aws-lambda'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { getClickhouseClient } from '@/utils/clickhouse/client'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { envIs } from '@/utils/env'
const s3Client = new S3Client({})

const DEFAULT_TENANT = 'default'

/**
 * CloudWatch Logs format from Firehose
 */
interface CloudWatchLogsData {
  messageType: string
  owner: string
  logGroup: string
  logStream: string
  subscriptionFilters: string[]
  logEvents: Array<{
    id: string
    timestamp: number
    message: string
  }>
}
/**
 * ClickHouse row format for cloudwatch_logs table
 */
interface CloudWatchLogRow {
  timestamp: number
  logGroup: string
  logStream: string
  message: string
  requestId: string
  logAttributes: Record<string, string> // All dynamic attributes go here
}

/**
 * Parse REPORT line to extract Lambda metrics
 * Returns attributes as Map for ClickHouse
 */
function parseReportLine(message: string): Record<string, string> {
  const requestIdMatch = message.match(/RequestId:\s+([a-zA-Z0-9-]+)/)

  if (!requestIdMatch) {
    return {}
  }
  const attributes: Record<string, string> = {
    requestId: requestIdMatch[1],
  }
  const durationMatch = message.match(/Duration:\s+([\d.]+)\s+ms/)
  const billedDurationMatch = message.match(/Billed Duration:\s+([\d]+)\s+ms/)
  const memorySizeMatch = message.match(/Memory Size:\s+([\d]+)\s+MB/)
  const maxMemoryMatch = message.match(/Max Memory Used:\s+([\d]+)\s+MB/)
  const initDurationMatch = message.match(/Init Duration:\s+([\d.]+)\s+ms/)
  const xrayTraceIdMatch = message.match(/XRAY TraceId:\s+([^\s\t]+)/)

  if (durationMatch) {
    attributes.duration = durationMatch[1]
  }
  if (billedDurationMatch) {
    attributes.billedDuration = billedDurationMatch[1]
  }
  if (memorySizeMatch) {
    attributes.memorySize = memorySizeMatch[1]
  }
  if (maxMemoryMatch) {
    attributes.maxMemoryUsed = maxMemoryMatch[1]
  }
  if (initDurationMatch) {
    attributes.initDuration = initDurationMatch[1]
  }
  if (xrayTraceIdMatch) {
    attributes.xrayTraceId = xrayTraceIdMatch[1]
  }

  return attributes
}
/**
 * Convert a stream to a buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Process CloudWatch Logs from S3 and insert into ClickHouse
 * The logs that come here are double compressed and hence we need to decompress it twice.
 */
export const handleCloudwatchLogsIngestion = async (event: S3Event) => {
  const bucket = event.Records[0].s3.bucket.name
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, ' ')
  )

  logger.info(`Processing file: ${key} from bucket: ${bucket}`)

  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const response = await s3Client.send(command)
    const bodyBuffer = await streamToBuffer(response.Body)

    let decompressed = gunzipSync(bodyBuffer as Uint8Array)

    if (decompressed[0] === 0x1f && decompressed[1] === 0x8b) {
      logger.debug('Double-compressed detected, decompressing again...')
      decompressed = gunzipSync(decompressed as Uint8Array)
    }

    const content = decompressed.toString('utf-8')

    const jsonObjects = content.split(/(?=\{"messageType")/)

    logger.info(`Found ${jsonObjects.length} log events`)
    let totalLogEvents = 0
    const rowsToInsert: CloudWatchLogRow[] = []
    for (const jsonStr of jsonObjects) {
      if (!jsonStr.trim()) {
        continue
      }
      try {
        const logData: CloudWatchLogsData = JSON.parse(jsonStr)

        logger.info(`\n--- Processing batch ---`)
        logger.info(`Log Group: ${logData.logGroup}`)
        logger.info(`Log Stream: ${logData.logStream}`)
        logger.info(`Log Events in this batch: ${logData.logEvents.length}`)

        // Process each log event
        for (const logEvent of logData.logEvents) {
          const message = logEvent.message.trim()

          try {
            // Normal JSON log
            const parsedMessage = JSON.parse(message)
            if (!parsedMessage.requestId) {
              continue
            }
            parsedMessage.entityId = parsedMessage.transactionId
            rowsToInsert.push({
              timestamp: logEvent.timestamp,
              logGroup: logData.logGroup,
              logStream: logData.logStream,
              requestId: parsedMessage.requestId,
              message,
              logAttributes: parsedMessage,
            })
          } catch {
            logger.debug('Not a JSON log, parsing for duration')
            //REPORT line with Lambda metrics
            const reportAttributes = parseReportLine(message)
            if (!reportAttributes.requestId) {
              continue
            }
            rowsToInsert.push({
              timestamp: logEvent.timestamp,
              logGroup: logData.logGroup,
              logStream: logData.logStream,
              requestId: reportAttributes.requestId,
              message,
              logAttributes: reportAttributes,
            })
          }
          totalLogEvents++
        }
      } catch (parseError) {
        logger.warn('Error parsing JSON object:', parseError)
        logger.warn('Problematic JSON string:', jsonStr.substring(0, 200))
      }
    }
    logger.info(`Total log events processed: ${totalLogEvents}`)
    if (rowsToInsert.length > 0) {
      logger.info('Inserting CloudWatch logs to ClickHouse', {
        tenant: DEFAULT_TENANT,
        count: rowsToInsert.length,
      })

      const client = await getClickhouseClient(DEFAULT_TENANT)

      await client.insert({
        table: CLICKHOUSE_DEFINITIONS.CLOUDWATCH_LOGS.tableName,
        values: rowsToInsert,
        format: 'JSONEachRow',
        clickhouse_settings: {
          wait_for_async_insert: 1,
          async_insert: envIs('test', 'local') ? 0 : 1,
        },
      })
    }

    logger.info('Successfully inserted CloudWatch logs to ClickHouse', {
      bucket,
      key,
      totalRecords: rowsToInsert.length,
    })
  } catch (error) {
    logger.error('Error processing file:', error)
    throw error
  }
}

export const cloudwatchLogsIngestionHandler = lambdaConsumer()(
  handleCloudwatchLogsIngestion
)
