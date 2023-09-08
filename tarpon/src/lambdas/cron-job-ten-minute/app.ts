import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-job'
import { logger } from '@/core/logger'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'

export const cronJobTenMinuteHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as 'dev' | 'sandbox' | 'prod',
    process.env.REGION as 'eu-1' | 'asia-1' | 'asia-2' | 'us-1' | 'eu-2'
  )

  try {
    const minus10 = new Date()
    const now = new Date()
    minus10.setMinutes(minus10.getMinutes() - 10)

    await Promise.all(
      tenantInfos.map(async (t) => {
        const userRefresh = await tenantHasFeature(t.tenant.id, 'PULSE')
        return sendBatchJobCommand({
          type: 'DASHBOARD_REFRESH',
          tenantId: t.tenant.id,
          parameters: {
            transactions: {
              startTimestamp: minus10.valueOf(),
              endTimestamp: now.valueOf(),
            },
            cases: {
              startTimestamp: minus10.valueOf(),
              endTimestamp: now.valueOf(),
            },
            users: userRefresh,
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
