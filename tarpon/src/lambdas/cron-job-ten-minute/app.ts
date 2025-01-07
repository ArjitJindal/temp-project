import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { CurrencyService } from '@/services/currency'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { tenantHasFeature } from '@/core/utils/context'
import { WebhookRetryRepository } from '@/services/webhook/repositories/webhook-retry-repository'

async function handleDashboardRefreshBatchJob(tenantIds: string[]) {
  try {
    const now = dayjs()
    const checkTimeRange = {
      // NOTE: Make the time window to be larger then the cron frequency to avoid gaps
      startTimestamp: now.subtract(30, 'minute').valueOf(),
      endTimestamp: now.valueOf(),
    }
    await Promise.all(
      tenantIds.map(async (tenantId) => {
        if (await tenantHasFeature(tenantId, 'MANUAL_DASHBOARD_REFRESH')) {
          return
        }
        return sendBatchJobCommand({
          type: 'DASHBOARD_REFRESH',
          tenantId,
          parameters: {
            checkTimeRange,
          },
        })
      })
    )
  } catch (e) {
    logger.error(
      `Failed to send dashboard refresh batch jobs: ${(e as Error)?.message}`,
      e
    )
  }
}

async function handleRiskScoringTriggerBatchJob(tenantIds: string[]) {
  const mongoDb = await getMongoDbClient()
  try {
    await Promise.all(
      tenantIds.map(async (id) => {
        const batchJobRepository = new BatchJobRepository(id, mongoDb)
        const pendingTriggerJobs = await batchJobRepository.getJobsByStatus(
          ['PENDING'],
          {
            filterType: 'RISK_SCORING_RECALCULATION',
          }
        )
        for (const job of pendingTriggerJobs) {
          if (
            job.latestStatus.scheduledAt &&
            job.latestStatus.scheduledAt <= Date.now()
          ) {
            await sendBatchJobCommand(job, job.jobId)
          }
        }
      })
    )
  } catch (e) {
    logger.error(
      `Failed to send risk scoring re run on triggers batch jobs: ${
        (e as Error)?.message
      }`,
      e
    )
  }
}

async function handleSlaStatusCalculationBatchJob(tenantIds: string[]) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  try {
    await Promise.all(
      tenantIds.map(async (id) => {
        const tenantService = new TenantService(id, { mongoDb, dynamoDb })
        const features = (await tenantService.getTenantSettings()).features
        if (features?.includes('ALERT_SLA')) {
          await sendBatchJobCommand({
            type: 'ALERT_SLA_STATUS_REFRESH',
            tenantId: id,
          })
        }
        if (features?.includes('PNB')) {
          await sendBatchJobCommand({
            type: 'CASE_SLA_STATUS_REFRESH',
            tenantId: id,
          })
        }
      })
    )
  } catch (e) {
    logger.error(
      `Failed to send SLA status calculation batch jobs: ${
        (e as Error)?.message
      }`,
      e
    )
  }
}

async function handleFinCenReportStatusBatchJob(tenantIds: string[]) {
  try {
    await Promise.all(
      tenantIds.map(async (id) => {
        await sendBatchJobCommand({
          type: 'FINCEN_REPORT_STATUS_REFRESH',
          tenantId: id,
        })
      })
    )
  } catch (e) {
    logger.error(
      `Failed to handle FinCen report status batch job: ${
        (e as Error)?.message
      }`,
      e
    )
  }
}

export const cronJobTenMinuteHandler = lambdaConsumer()(async () => {
  // Hack to ensure we query the currency data for viper.
  await new CurrencyService().getCurrencyExchangeRate('USD', 'EUR')
  const tenantIds = await TenantService.getAllTenantIds()
  await handleDashboardRefreshBatchJob(tenantIds)
  await handleSlaStatusCalculationBatchJob(tenantIds)
  await handleRiskScoringTriggerBatchJob(tenantIds)
  await deleteOldWebhookRetryEvents(tenantIds)
  await handleFinCenReportStatusBatchJob(tenantIds)
})

async function deleteOldWebhookRetryEvents(tenantIds: string[]) {
  const mongoDb = await getMongoDbClient()
  try {
    await Promise.all(
      tenantIds.map(async (tenantId) => {
        const webhookRetryRepository = new WebhookRetryRepository(
          tenantId,
          mongoDb
        )
        const count = await webhookRetryRepository.countWebhookRetryEvents()

        if (count) {
          await sendBatchJobCommand({ type: 'WEBHOOK_RETRY', tenantId })
        }
      })
    )
  } catch (e) {
    logger.error(
      `Failed to delete old webhook retry events: ${(e as Error)?.message}`,
      e
    )
  }
}
