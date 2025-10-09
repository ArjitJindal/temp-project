import { MongoClient } from 'mongodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { ApiUsageMetrics } from '../metrics/utils'
import { BatchJobRunner } from '@/services/batch-jobs/batch-job-runner-base'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import {
  BatchJobInDb,
  DynamodbClickhouseBackfillBatchJob,
} from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import {
  API_REQUEST_LOGS_COLLECTION,
  AUDITLOG_COLLECTION,
  GPT_REQUESTS_COLLECTION,
  JOBS_COLLECTION,
  CASES_COLLECTION,
  WEBHOOK_COLLECTION,
  WEBHOOK_DELIVERY_COLLECTION,
} from '@/utils/mongo-table-names'
import { Notification } from '@/@types/openapi-internal/Notification'
import { linkLLMRequestDynamoDB, LLMLogObject } from '@/utils/llms'
import { ApiRequestLog } from '@/@types/request-logger'
import { handleRequestLoggerTaskClickhouse } from '@/lambdas/request-logger/utils'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { Case } from '@/@types/openapi-internal/Case'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { WebhookDeliveryAttempt } from '@/@types/openapi-internal/all'

@traceable
export class DynamodbClickhouseBackfillBatchJobRunner extends BatchJobRunner {
  protected async run(job: DynamodbClickhouseBackfillBatchJob): Promise<void> {
    const { entity } = job.parameters
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    switch (entity) {
      case 'ALERTS_QA_SAMPLING':
        await handleAlertsQaSamplingBatchJob(job, {
          mongoDb,
          dynamoDb,
        })
        break
      case 'GPT_REQUEST_LOGS':
        await handleGPTRequestLogsBatchJob(job, {
          mongoDb,
        })
        break
      case 'NOTIFICATIONS':
        await handleNotificationsBatchJob(job, {
          mongoDb,
          dynamoDb,
        })
        break
      case 'AUDIT_LOG':
        await handleAuditLogBatchJob(job, {
          mongoDb,
          dynamoDb,
        })
        break
      case 'METRICS':
        await handleMetricsBatchJob(job, {
          mongoDb,
          dynamoDb,
        })
        break
      case 'API_REQUEST_LOGS':
        await handleApiRequestLogsBatchJob(job, {
          mongoDb,
        })
        break
      case 'CASES':
        await handleCasesBatchJob(job, {
          mongoDb,
          dynamoDb,
        })
        break
      case 'BATCH_JOBS':
        await handleJobBatchJob(job, {
          mongoDb,
          dynamoDb,
        })
        break
      case 'WEBHOOK_CONFIGURATION':
        await handleWebhookConfigurationBatchJob(job, {
          mongoDb,
          dynamoDb,
        })
        break
      case 'WEBHOOK_DELIVERY':
        await handleWebhookDeliveryBatchJob(job, {
          mongoDb,
        })
        break
      default:
        throw new Error(`Unknown entity: ${entity}`)
    }
  }
}

const handleAlertsQaSamplingBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }
) => {
  const { DynamoAlertRepository } = await import('../alerts/dynamo-repository')
  const { ALERTS_QA_SAMPLING_COLLECTION } = await import(
    '@/utils/mongo-table-names'
  )

  const dynamoAlertRepository = new DynamoAlertRepository(
    job.tenantId,
    dynamoDb
  )
  const db = mongoDb.db()
  const alertsCollection = db.collection<AlertsQaSampling>(
    ALERTS_QA_SAMPLING_COLLECTION(job.tenantId)
  )

  await processCursorInBatch(
    alertsCollection.find({}),
    async (alerts) => {
      for (const alert of alerts) {
        await dynamoAlertRepository.saveQASampleData(alert)
      }
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
  logger.info(`Completed dynamoDB backfill for alerts_qa_sampling`)
}

export const handleNotificationsBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }
) => {
  const { DynamoNotificationRepository } = await import(
    '../notifications/dynamo-repository'
  )
  const { NOTIFICATIONS_COLLECTION } = await import('@/utils/mongo-table-names')
  const db = mongoDb.db()
  const notificationsCollection = db.collection<Notification>(
    NOTIFICATIONS_COLLECTION(job.tenantId)
  )
  const notificationsRepository = new DynamoNotificationRepository(
    job.tenantId,
    dynamoDb
  )
  await processCursorInBatch(
    notificationsCollection.find({}),
    async (notifications) => {
      await notificationsRepository.saveToDynamoDb(
        notifications as Notification[]
      )
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

export const handleGPTRequestLogsBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
  }: {
    mongoDb: MongoClient
  }
) => {
  const db = mongoDb.db()
  const collection = db.collection<LLMLogObject>(
    GPT_REQUESTS_COLLECTION(job.tenantId)
  )
  await processCursorInBatch(
    collection.find({}),
    async (llmRequests) => {
      await linkLLMRequestDynamoDB(job.tenantId, llmRequests)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

export const handleApiRequestLogsBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
  }: {
    mongoDb: MongoClient
  }
) => {
  const db = mongoDb.db()
  const apiRequestLogsCollection = db.collection<ApiRequestLog>(
    API_REQUEST_LOGS_COLLECTION(job.tenantId)
  )
  await processCursorInBatch(
    apiRequestLogsCollection.find({}),
    async (apiRequestLogs) => {
      await handleRequestLoggerTaskClickhouse(job.tenantId, apiRequestLogs)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

export const handleAuditLogBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }
) => {
  const { DynamoAuditLogRepository } = await import(
    '../audit-log/repositories/dynamo-repository'
  )

  const auditLogRepository = new DynamoAuditLogRepository(
    job.tenantId,
    dynamoDb
  )
  const db = mongoDb.db()
  const auditLogCollection = db.collection<AuditLog>(
    AUDITLOG_COLLECTION(job.tenantId)
  )

  await processCursorInBatch(auditLogCollection.find({}), async (auditLogs) => {
    for (const auditLog of auditLogs) {
      await auditLogRepository.saveAuditLog(auditLog)
    }
  })
}

export const handleMetricsBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }
) => {
  const { ApiUsageMetricsService } = await import(
    '@/services/metrics/api-usage-metrics-service'
  )
  const { METRICS_COLLECTION } = await import('@/utils/mongo-table-names')

  const metricsService = new ApiUsageMetricsService({
    mongoDb,
    dynamoDb,
  })
  const db = mongoDb.db()
  const metricsCollection = db.collection<ApiUsageMetrics>(
    METRICS_COLLECTION(job.tenantId)
  )
  await processCursorInBatch(
    metricsCollection.find({}),
    async (metrics) => {
      await metricsService.linkMetricsToClickhouse(job.tenantId, metrics)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

export const handleCasesBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBClient
  }
) => {
  const { DynamoCaseRepository } = await import(
    '@/services/cases/dynamo-repository'
  )
  const keys = DynamoDbKeys.DYNAMO_CLICKHOUSE(job.tenantId, 'CASES_ALERTS')
  const createdAt = Date.now()
  await dynamoDb.send(
    new UpdateCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(job.tenantId),
      Key: keys,
      UpdateExpression: 'SET isMigrated = :isMigrated, createdAt = :createdAt',
      ExpressionAttributeValues: {
        ':isMigrated': false,
        ':createdAt': createdAt,
      },
    })
  )
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(job.tenantId))
  const caseRepository = new DynamoCaseRepository(job.tenantId, dynamoDb)
  await processCursorInBatch(
    casesCollection.find({}),
    async (cases) => {
      await caseRepository.saveCases(cases, job.parameters.saveToClickhouse)
    },
    { mongoBatchSize: 1000, processBatchSize: 100, debug: true }
  )
  const updatedAt = Date.now()
  await dynamoDb.send(
    new UpdateCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(job.tenantId),
      Key: keys,
      UpdateExpression: 'SET isMigrated = :isMigrated, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isMigrated': true,
        ':updatedAt': updatedAt,
      },
    })
  )
  await processCursorInBatch(
    casesCollection.find({
      updatedAt: { $exists: true, $gte: createdAt, $lt: updatedAt },
    }),
    async (cases) => {
      await caseRepository.saveCases(cases, job.parameters.saveToClickhouse)
    },
    { mongoBatchSize: 1000, processBatchSize: 100, debug: true }
  )
}

export const handleJobBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }
) => {
  const { DynamoBatchJobRepository } = await import(
    '@/services/batch-jobs/repositories/dynamo-repository'
  )
  const db = mongoDb.db()

  const jobCollection = db.collection<BatchJobInDb>(
    JOBS_COLLECTION(job.tenantId)
  )
  const dynamoRepository = new DynamoBatchJobRepository(job.tenantId, dynamoDb)

  await processCursorInBatch(
    jobCollection.find({}),
    async (jobs) => {
      await dynamoRepository.saveJobs(jobs)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

const handleWebhookConfigurationBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
) => {
  const { DynamoWebhookRepository } = await import(
    '../webhook/repositories/dynamo-webhook-repository'
  )
  const db = mongoDb.db()
  const webhookCollection = db.collection<WebhookConfiguration>(
    WEBHOOK_COLLECTION(job.tenantId)
  )
  const dynamoWebhookRepository = new DynamoWebhookRepository(
    job.tenantId,
    dynamoDb
  )
  await processCursorInBatch(
    webhookCollection.find({}),
    async (webhooks) => {
      await dynamoWebhookRepository.saveToDynamo(webhooks)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

const handleWebhookDeliveryBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  { mongoDb }: { mongoDb: MongoClient }
) => {
  const { WebhookDeliveryRepository } = await import(
    '../webhook/repositories/webhook-delivery-repository'
  )
  const db = mongoDb.db()
  const webhookDeliveryCollection = db.collection<WebhookDeliveryAttempt>(
    WEBHOOK_DELIVERY_COLLECTION(job.tenantId)
  )
  const webhookRepository = new WebhookDeliveryRepository(job.tenantId, mongoDb)
  await processCursorInBatch(
    webhookDeliveryCollection.find({}),
    async (webhookDeliveries) => {
      await webhookRepository.linkWebhookDeliveryClickhouse(webhookDeliveries)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}
