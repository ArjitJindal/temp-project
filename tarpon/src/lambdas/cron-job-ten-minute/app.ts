import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { CurrencyService } from '@/services/currency'

import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function handleDashboardRefreshBatchJob(tenantIds: string[]) {
  try {
    const now = dayjs()
    const checkTimeRange = {
      // NOTE: Make the time window to be larger then the cron frequency to avoid gaps
      startTimestamp: now.subtract(30, 'minute').valueOf(),
      endTimestamp: now.valueOf(),
    }
    await Promise.all(
      tenantIds.map(async (id) => {
        return sendBatchJobCommand({
          type: 'DASHBOARD_REFRESH',
          tenantId: id,
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

async function handleSlaStatusCalculationBatchJob(tenantIds: string[]) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  try {
    await Promise.all(
      tenantIds.map(async (id) => {
        const tenantService = new TenantService(id, { mongoDb, dynamoDb })
        const features = (await tenantService.getTenantSettings()).features
        if (!features?.includes('ALERT_SLA')) {
          return
        }
        return sendBatchJobCommand({
          type: 'ALERT_SLA_STATUS_REFRESH',
          tenantId: id,
        })
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

export const cronJobTenMinuteHandler = lambdaConsumer()(async () => {
  // Hack to ensure we query the currency data for viper.
  await new CurrencyService().getCurrencyExchangeRate('USD', 'EUR')
  const tenantIds = await TenantService.getAllTenantIds()
  await handleDashboardRefreshBatchJob(tenantIds)
  await handleSlaStatusCalculationBatchJob(tenantIds)
})
