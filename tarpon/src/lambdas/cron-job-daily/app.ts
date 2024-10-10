import { chunk, groupBy, mapValues } from 'lodash'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { getTenantInfoFromUsagePlans } from '@flagright/lib/tenants/usage-plans'
import { cleanUpStaleQaEnvs } from '@lib/qa-cleanup'
import { sendCaseCreatedAlert } from '../slack-app/app'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TenantInfo, TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { envIs } from '@/utils/env'
import { AccountsService } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

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
  try {
    const tenantsToDeactivate = await TenantService.getTenantsToDelete()
    for (const tenant of tenantsToDeactivate) {
      if (!tenant.tenantId) {
        logger.error(
          `Failed to delete record ${JSON.stringify(
            tenant
          )}: no tenantIdToDelete`
        )

        continue
      }

      await sendBatchJobCommand({
        type: 'TENANT_DELETION',
        tenantId: tenant.tenantId,
        parameters: {
          notRecoverable:
            tenant.latestStatus === 'WAITING_HARD_DELETE'
              ? true
              : tenant.notRecoverable || false,
        },
      })
    }
  } catch (e) {
    logger.error(`Failed to delete tenants: ${(e as Error)?.message}`, e)
  }

  try {
    await checkDormantUsers(tenantInfos)
  } catch (e) {
    logger.error(`Failed to check dormant users: ${(e as Error)?.message}`, e)
  }

  await sendBatchJobCommand({
    type: 'SANCTIONS_DATA_FETCH',
    tenantId: 'flagright',
    parameters: {
      from: dayjs().subtract(1, 'day').toISOString(),
    },
  })

  await Promise.all(
    tenantInfos.map((tenant) => sendCaseCreatedAlert(tenant.tenant.id))
  )

  if (envIs('dev')) {
    await cleanUpStaleQaEnvs()
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
        parameters: {
          tenantInfos: tenants,
          targetMonth: dayjs().subtract(2, 'day').format('YYYY-MM'),
          googleSheetIds: googleSheetIds,
        },
      })
    }
  }
}

async function createOngoingScreeningJobs(tenantInfos: TenantInfo[]) {
  for await (const tenant of tenantInfos) {
    const tenantId = tenant.tenant.id

    await sendBatchJobCommand({
      type: 'ONGOING_SCREENING_USER_RULE',
      tenantId,
    })
  }
}

async function checkDormantUsers(tenantInfos: TenantInfo[]) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  for await (const tenant of tenantInfos) {
    const accountsService = new AccountsService(
      { auth0Domain: tenant.auth0Domain },
      { mongoDb }
    )
    const tenantSettings = await new TenantRepository(tenant.tenant.id, {
      dynamoDb,
      mongoDb,
    }).getTenantSettings()

    const accounts = (
      await accountsService.getTenantAccounts(tenant.tenant)
    ).filter((account) => !account.blocked)

    for await (const account of accounts) {
      const accountDormancyAllowedDays =
        tenantSettings?.accountDormancyAllowedDays ?? 0
      if (account.lastLogin && accountDormancyAllowedDays > 0) {
        const lastLogin = dayjs(account.lastLogin)
        const lastLoginDate = lastLogin.format('YYYY-MM-DD')
        const currentDate = dayjs().format('YYYY-MM-DD')
        const diff = dayjs(currentDate).diff(lastLoginDate, 'day')
        if (diff > accountDormancyAllowedDays) {
          await accountsService.deactivateAccount(
            tenant.tenant,
            account.id,
            'DORMANT'
          )
        }
      }
    }
  }
}
