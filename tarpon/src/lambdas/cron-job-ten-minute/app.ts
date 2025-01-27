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
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { WebhookRetryRepository } from '@/services/webhook/repositories/webhook-retry-repository'
import {
  getTimeFromRegion,
  JobRunConfig,
  shouldRun,
} from '@/utils/sla-scheduler'
import { SLAService } from '@/services/sla/sla-service'

const batchJobScheduler5Hours10Minutes: JobRunConfig = {
  windowStart: 18,
  windowEnd: 9,
  runIntervalInHours: 5,
  checkCallInterval: 10,
  shouldRunWhenOutsideWindow: true,
} // runs job at interval of 5 hours, check for running condition every 10 minutes. If the time is outside the run window it runs with different frequency

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
          const slaService = new SLAService(id, '', {
            mongoDb,
            dynamoDb,
          })
          await slaService.handleSendingSlaRefreshJobs()
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
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    await Promise.all(
      tenantIds.map(async (id) => {
        const reportRepository = new ReportRepository(
          // 1. get all sla reports that have submitting and submit accept status
          id,
          mongoDb,
          dynamoDb
        )
        const hasUsReports = await reportRepository.hasValidJurisdictionReports(
          ['SUBMITTING', 'SUBMISSION_ACCEPTED'],
          'US',
          Date.now() - 1000 * 60 * 10 // TODO: need to update this to 60 minutes
        )
        logger.info('USA report to fetch', hasUsReports)
        if (hasUsReports) {
          await sendBatchJobCommand({
            type: 'FINCEN_REPORT_STATUS_REFRESH',
            tenantId: id,
          })
        }
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
  try {
    const now = getTimeFromRegion()
    // Hack to ensure we query the currency data for viper.
    await new CurrencyService().getCurrencyExchangeRate('USD', 'EUR')
    const tenantIds = await TenantService.getAllTenantIds()
    await handleDashboardRefreshBatchJob(tenantIds)

    if (shouldRun(batchJobScheduler5Hours10Minutes, now)) {
      await handleSlaStatusCalculationBatchJob(tenantIds)
    }

    await handleRiskScoringTriggerBatchJob(tenantIds)
    await deleteOldWebhookRetryEvents(tenantIds)
    await handleFinCenReportStatusBatchJob(tenantIds)
  } catch (error) {
    logger.error('Error in 10 minute cron job handler', error)
    throw error
  }
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
