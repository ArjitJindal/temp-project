import { MongoClient } from 'mongodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchJobRunner } from '@/services/batch-jobs/batch-job-runner-base'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { DynamodbClickhouseBackfillBatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongodb-definitions'
import { ApiRequestLog } from '@/@types/request-logger'
import { saveApiRequestLogsToDynamo } from '@/lambdas/request-logger/app'
import { Notification } from '@/@types/openapi-internal/Notification'

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
      case 'API_REQUEST_LOGS':
        await handleApiRequestLogsBatchJob(job, {
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
    dynamoDb: DynamoDBClient
  }
) => {
  const { DynamoAlertRepository } = await import('../alerts/dynamo-repository')
  const { ALERTS_QA_SAMPLING_COLLECTION } = await import(
    '@/utils/mongodb-definitions'
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

const handleApiRequestLogsBatchJob = async (
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
      await saveApiRequestLogsToDynamo(apiRequestLogs, job.tenantId)
    },
    { mongoBatchSize: 100, processBatchSize: 10, debug: true }
  )
}

export const handleNotificationsBatchJob = async (
  job: DynamodbClickhouseBackfillBatchJob,
  {
    mongoDb,
    dynamoDb,
  }: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBClient
  }
) => {
  const { DynamoNotificationRepository } = await import(
    '../notifications/dynamo-repository'
  )
  const { NOTIFICATIONS_COLLECTION } = await import(
    '@/utils/mongodb-definitions'
  )
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
