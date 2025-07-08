import { SQSEvent } from 'aws-lambda'
import { groupBy } from 'lodash'
import * as Sentry from '@sentry/serverless'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { logger } from '@/core/logger'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getAllTenantIds, getNonDemoTenantId } from '@/utils/tenant'
import { ApiRequestLog } from '@/@types/request-logger'
import {
  batchInsertToClickhouse,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
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
  Sentry.captureException(
    new Error(`Unknown tenantId found: ${log.tenantId}`),
    {
      extra: {
        tenantId: log.tenantId,
        requestId: log.requestId || 'no-request-id',
        traceId: log.traceId,
        path: log.path,
        method: log.method,
        timestamp: log.timestamp,
      },
    }
  )
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
    if (
      !allTenantIds.has(getNonDemoTenantId(log.tenantId)) &&
      !envIs('local', 'test')
    ) {
      logger.info(`log tenantId: ${log.tenantId}`)
      logger.info(`allTenantIds: ${JSON.stringify(allTenantIds, null, 2)}`)
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

export const handleRequestLoggerTaskClickhouse = async (
  tenantId: string,
  logs: ApiRequestLog[]
) => {
  await batchInsertToClickhouse(
    tenantId,
    CLICKHOUSE_DEFINITIONS.API_REQUEST_LOGS.tableName,
    logs
  )
}

export const requestLoggerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const logs = event.Records.map(
      (record) => JSON.parse(record.body) as ApiRequestLog
    )
    await handleRequestLoggerTask(logs)
  }
)
