import _ from 'lodash'
import { getOngoingScreeningUserRuleInstances } from '../batch-job/ongoing-screening-user-rule-batch-job-runner'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { TenantInfo, TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-job'
import {
  ApiUsageMetricsBatchJob,
  OngoingScreeningUserRuleBatchJob,
} from '@/@types/batch-job'
import { UserRepository } from '@/services/users/repositories/user-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'

const ONGOING_SCREENING_USERS_BATCH_SIZE = 100

export const cronJobDailyHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as 'dev' | 'sandbox' | 'prod',
    process.env.REGION as 'eu-1' | 'asia-1' | 'asia-2' | 'us-1' | 'eu-2'
  )

  try {
    await createApiUsageJobs(tenantInfos)
  } catch (e) {
    logger.error(`Failed to create API usage jobs: ${(e as Error)?.message}`, e)
  }
  try {
    await createOngoingScreeningJobs(tenantInfos)
  } catch (e) {
    logger.error(
      `Failed to create ongoing screening jobs: ${(e as Error)?.message}`,
      e
    )
  }
})

async function createApiUsageJobs(tenantInfos: TenantInfo[]) {
  const basicTenants = await TenantService.getTenantInfoFromUsagePlans()
  const tenantsBySheets = _.mapValues(
    _.groupBy(basicTenants, (basicTenant) => {
      const auth0Tenant = tenantInfos.find(
        (t) => t.tenant.id === basicTenant.id
      )
      return auth0Tenant?.auth0TenantConfig.apiUsageGoogleSheetId ?? ''
    }),
    (tenants) =>
      tenants.map((tenant) => {
        const auth0Tenant = tenantInfos.find((t) => t.tenant.id === tenant.id)
        return {
          ...tenant,
          auth0Domain: auth0Tenant?.auth0Domain,
        }
      })
  )
  for (const sheetId in tenantsBySheets) {
    for (const tenants of _.chunk(tenantsBySheets[sheetId], 5)) {
      const googleSheetIds = [
        process.env.API_USAGE_GOOGLE_SHEET_ID as string,
        sheetId,
      ].filter(Boolean)

      const job: ApiUsageMetricsBatchJob = {
        type: 'API_USAGE_METRICS',
        tenantId: '',
        tenantInfos: tenants,
        targetMonth: dayjs().subtract(2, 'day').format('YYYY-MM'),
        googleSheetIds: googleSheetIds,
      }
      await sendBatchJobCommand('', job)
    }
  }
}

async function createOngoingScreeningJobs(tenantInfos: TenantInfo[]) {
  const mongoDb = await getMongoDbClient()
  for await (const tenant of tenantInfos) {
    const tenantId = tenant.tenant.id
    if ((await getOngoingScreeningUserRuleInstances(tenantId)).length > 0) {
      const userRepository = new UserRepository(tenantId, {
        mongoDb,
      })
      let userIdsBatch: string[] = []
      // One job only deals with a subset of users to avoid the job to run for over 15 minutes
      for await (const item of await userRepository.getAllUserIdsCursor()) {
        userIdsBatch.push(item.userId)
        if (userIdsBatch.length === ONGOING_SCREENING_USERS_BATCH_SIZE) {
          const job: OngoingScreeningUserRuleBatchJob = {
            type: 'ONGOING_SCREENING_USER_RULE',
            tenantId,
            userIds: userIdsBatch,
          }
          await sendBatchJobCommand(tenantId, job)
          userIdsBatch = []
        }
      }
      if (userIdsBatch.length > 0) {
        const job: OngoingScreeningUserRuleBatchJob = {
          type: 'ONGOING_SCREENING_USER_RULE',
          tenantId,
          userIds: userIdsBatch,
        }
        await sendBatchJobCommand(tenantId, job)
      }
    }
  }
}
