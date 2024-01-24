import { chunk, groupBy, mapValues } from 'lodash'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { getTenantInfoFromUsagePlans } from '@flagright/lib/tenants/usage-plans'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TenantInfo, TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { UserRepository } from '@/services/users/repositories/user-repository'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { getOngoingScreeningUserRuleInstances } from '@/services/batch-jobs/ongoing-screening-user-rule-batch-job-runner'
import { envIs } from '@/utils/env'
const ONGOING_SCREENING_USERS_BATCH_SIZE = 100

export const cronJobDailyHandler = lambdaConsumer()(async () => {
  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as Stage,
    process.env.REGION as FlagrightRegion
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
  const basicTenants = await getTenantInfoFromUsagePlans(
    envIs('local') ? 'eu-central-1' : process.env.AWS_REGION || 'eu-central-1'
  )
  const tenantsBySheets = mapValues(
    groupBy(basicTenants, (basicTenant) => {
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
    for (const tenants of chunk(tenantsBySheets[sheetId], 5)) {
      const googleSheetIds = [
        process.env.API_USAGE_GOOGLE_SHEET_ID as string,
        sheetId,
      ].filter(Boolean)

      await sendBatchJobCommand({
        type: 'API_USAGE_METRICS',
        tenantId: '',
        tenantInfos: tenants,
        targetMonth: dayjs().subtract(2, 'day').format('YYYY-MM'),
        googleSheetIds: googleSheetIds,
      })
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
          await sendBatchJobCommand({
            type: 'ONGOING_SCREENING_USER_RULE',
            tenantId,
            userIds: userIdsBatch,
          })
          userIdsBatch = []
        }
      }
      if (userIdsBatch.length > 0) {
        await sendBatchJobCommand({
          type: 'ONGOING_SCREENING_USER_RULE',
          tenantId,
          userIds: userIdsBatch,
        })
      }
    }
  }
}
