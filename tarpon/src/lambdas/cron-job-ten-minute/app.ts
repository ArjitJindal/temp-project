import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'

export const cronJobTenMinuteHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as Stage,
    process.env.REGION as FlagrightRegion
  )

  try {
    const now = dayjs()
    const checkTimeRange = {
      // NOTE: Make the time window to be larger then the cron frequency to avoid gaps
      startTimestamp: now.subtract(30, 'minute').valueOf(),
      endTimestamp: now.valueOf(),
    }

    await Promise.all(
      tenantInfos.map(async (t) => {
        return sendBatchJobCommand({
          type: 'DASHBOARD_REFRESH',
          tenantId: t.tenant.id,
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
})
