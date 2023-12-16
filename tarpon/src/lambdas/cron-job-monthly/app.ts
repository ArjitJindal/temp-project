import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { tenantHasFeature } from '@/core/utils/context'
import { sendBatchJobCommand } from '@/services/batch-job'
import { TenantService } from '@/services/tenants'
import { FlagrightRegion, Stage } from '@/utils/env'

export const cronJobMonthlyHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as Stage,
    process.env.REGION as FlagrightRegion
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
