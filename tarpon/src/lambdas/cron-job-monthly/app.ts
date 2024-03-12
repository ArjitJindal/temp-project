import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { tenantHasFeature } from '@/core/utils/context'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { TenantService } from '@/services/tenants'

export const cronJobMonthlyHandler = lambdaConsumer()(async () => {
  const tenantIds = await TenantService.getAllTenantIds()

  for await (const id of tenantIds) {
    const isMerchantMonitotingEnabled = await tenantHasFeature(
      id,
      'MERCHANT_MONITORING'
    )

    if (isMerchantMonitotingEnabled) {
      await sendBatchJobCommand({
        type: 'ONGOING_MERCHANT_MONITORING',
        tenantId: id,
      })
    }
  }
})
