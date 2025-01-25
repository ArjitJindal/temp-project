import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

export const cronJobHourlyHandler = lambdaConsumer()(async () => {
  await syncAccountAndOrganizations()
})

async function syncAccountAndOrganizations() {
  await sendBatchJobCommand({
    type: 'SYNC_AUTH0_DATA',
    tenantId: FLAGRIGHT_TENANT_ID,
    parameters: { type: 'ALL' },
  })
}
