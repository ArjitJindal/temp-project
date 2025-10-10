import { SQSEvent } from 'aws-lambda'
import groupBy from 'lodash/groupBy'
import { captureException as captureExceptionSentry } from '@sentry/aws-serverless'
import { handleRequestLoggerTaskClickhouse } from './utils'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongo-table-names'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getAllTenantIds } from '@/utils/tenant'
import { getNonDemoTenantId } from '@/utils/tenant-id'
import { ApiRequestLog } from '@/@types/request-logger'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { envIs } from '@/utils/env'

const captureException = (log: ApiRequestLog) => {
  logger.warn('Unknown tenantId found:', {
    tenantId: log.tenantId,
    requestId: log.requestId || 'no-request-id',
    traceId: log.traceId,
    path: log.path,
    method: log.method,
    timestamp: log.timestamp,
  })
  captureExceptionSentry(new Error(`Unknown tenantId found: ${log.tenantId}`), {
    extra: {
      tenantId: log.tenantId,
      requestId: log.requestId || 'no-request-id',
      traceId: log.traceId,
      path: log.path,
      method: log.method,
      timestamp: log.timestamp,
    },
  })
}

export const handleRequestLoggerTask = async (logs: ApiRequestLog[]) => {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const webhookStartPath = '/console/webhook'
  const nonWebhookLogs = logs.filter(
    (log) => !log.path.startsWith(webhookStartPath)
  )
  const allTenantIds = await getAllTenantIds()
  const filteredLogs = nonWebhookLogs.filter((log) => {
    if (!log.tenantId) {
      logger.warn('No tenantId found in request log:', {
        log,
      })
      captureException(log)
      return false
    }

    if (
      !allTenantIds.has(getNonDemoTenantId(log.tenantId)) &&
      !envIs('local', 'test')
    ) {
      captureException(log)
      return false
    }
    return true
  })

  const logGroups = groupBy(filteredLogs, (log) => log.tenantId)

  for (const tenantId in logGroups) {
    const tenantLogs = logGroups[tenantId]
    if (isClickhouseEnabledInRegion()) {
      await handleRequestLoggerTaskClickhouse(tenantId, tenantLogs)
    }
    const requestLoggerCollectionName = API_REQUEST_LOGS_COLLECTION(tenantId)
    await db
      .collection(requestLoggerCollectionName)
      .insertMany(tenantLogs, { ordered: false })
  }
}

export const requestLoggerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const logs = event.Records.map(
      (record) => JSON.parse(record.body) as ApiRequestLog
    )
    await handleRequestLoggerTask(logs)
  }
)
