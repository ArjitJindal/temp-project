import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { logger } from '@/core/logger'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { ReportRepository } from '@/services/sar/repositories/report-repository'
import { TenantService } from '@/services/tenants'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { isValidSARRequest } from '@/utils/helpers'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export const cronJobHourlyHandler = lambdaConsumer()(async () => {
  const tenantIds = await TenantService.getAllTenantIds()
  await syncAccountAndOrganizations()

  await handleFinCenReportStatusBatchJob(tenantIds)
})

async function syncAccountAndOrganizations() {
  await sendBatchJobCommand({
    type: 'SYNC_AUTH0_DATA',
    tenantId: FLAGRIGHT_TENANT_ID,
    parameters: { type: 'ALL' },
  })
}

async function handleFinCenReportStatusBatchJob(tenantIds: string[]) {
  try {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    await Promise.all(
      tenantIds.map(async (id) => {
        if (isValidSARRequest(id)) {
          const reportRepository = new ReportRepository(
            // 1. get all sla reports that have submitting and submit accept status
            id,
            mongoDb,
            dynamoDb
          )
          const hasUsReports =
            await reportRepository.hasValidJurisdictionReports(
              ['SUBMITTING', 'SUBMISSION_ACCEPTED'],
              'US',
              Date.now() - 1000 * 60 * 60 * 5
            )
          if (hasUsReports) {
            await sendBatchJobCommand({
              type: 'FINCEN_REPORT_STATUS_REFRESH',
              tenantId: id,
            })
          }
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
