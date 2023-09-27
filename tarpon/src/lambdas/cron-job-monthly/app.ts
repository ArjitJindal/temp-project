import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { sendBatchJobCommand } from '@/services/batch-job'
import { TenantService } from '@/services/tenants'

export const cronJobMonthlyHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as 'dev' | 'sandbox' | 'prod',
    process.env.REGION as 'eu-1' | 'asia-1' | 'asia-2' | 'us-1' | 'eu-2'
  )

  for await (const tenantInfo of tenantInfos) {
    const isMerchantMonitotingEnabled = await tenantHasFeature(
      tenantInfo.tenant.id,
      'MERCHANT_MONITORING'
    )

    if (isMerchantMonitotingEnabled) {
      await sendBatchJobCommand({
        type: 'ONGOING_MERCHANT_MONITORING',
        tenantId: tenantInfo.tenant.id,
      })
    }
  }
})
