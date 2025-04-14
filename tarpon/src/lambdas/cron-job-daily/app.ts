import { chunk, compact, groupBy, mapValues } from 'lodash'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { getTenantInfoFromUsagePlans } from '@flagright/lib/tenants/usage-plans'
import { isQaEnv } from '@flagright/lib/qa'
import { WebClient } from '@slack/web-api'
import axios from 'axios'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { sendCaseCreatedAlert } from '../slack-app/app'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TenantInfo, TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import dayjs from '@/utils/dayjs'
import { logger } from '@/core/logger'
import { envIs } from '@/utils/env'
import { AccountsService } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import {
  COLLECTIONS_MAP,
  FEATURE_FLAG_PROVIDER_MAP,
  getTargetProviders,
  getTenantSpecificProviders,
  isSanctionsDataFetchTenantSpecific,
} from '@/services/sanctions/utils'
import { TRIAGE_QUEUE_TICKETS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TriageQueueTicket } from '@/@types/triage'
import { getSecret } from '@/utils/secrets-manager'
import {
  CUSTOMER_ON_CALL_GROUP_ID,
  ENGINEERING_GROUP_ID,
  ENGINEERING_ON_CALL_GROUP_ID,
  INCIDENTS_BUGS_CHANNEL_ID,
} from '@/utils/slack'
import { BatchJob } from '@/@types/batch-job'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

export const cronJobDailyHandler = lambdaConsumer()(async () => {
  const dynamoDb = getDynamoDbClient()
  if (envIs('dev')) {
    try {
      await clearTriageQueueTickets()
    } catch (e) {
      logger.error(
        `Failed to clear triage queue tickets: ${(e as Error)?.message}`,
        e
      )
    }

    try {
      await updateOncallUsers()
    } catch (e) {
      logger.error(`Failed to update oncall users: ${(e as Error)?.message}`, e)
    }
  }

  const tenantInfos = await TenantService.getAllTenants(
    process.env.ENV as Stage,
    process.env.REGION as FlagrightRegion
  )

  try {
    await createApiUsageJobs(tenantInfos)
  } catch (e) {
    logger.error(`Failed to create API usage jobs: ${(e as Error)?.message}`, e)
  }
  const commonDataTenantIds: string[] = []
  await Promise.all(
    tenantInfos.flatMap(async (tenant) => {
      const batchJobs: BatchJob[] = [
        {
          type: 'PERIODIC_SCREENING_USER_RULE',
          tenantId: tenant.tenant.id,
        },
      ]
      const tenantRepository = new TenantRepository(tenant.tenant.id, {
        dynamoDb,
      })
      const { features } = await tenantRepository.getTenantSettings([
        'features',
      ])
      const providers = compact(
        features?.map((feature) => FEATURE_FLAG_PROVIDER_MAP[feature])
      )
      if (providers.length && isSanctionsDataFetchTenantSpecific(providers)) {
        batchJobs.push({
          type: 'SANCTIONS_DATA_FETCH',
          tenantId: tenant.tenant.id,
          providers: getTenantSpecificProviders(providers),
          parameters: {
            from: dayjs().subtract(1, 'day').toISOString(),
          },
        })
        batchJobs.push({
          type: 'DELTA_SANCTIONS_DATA_FETCH',
          tenantId: tenant.tenant.id,
          providers: getTenantSpecificProviders(providers),
          parameters: {
            from: dayjs().subtract(1, 'day').toISOString(),
            ongoingScreeningTenantIds: [tenant.tenant.id],
          },
        })
      } else if (providers.length) {
        commonDataTenantIds.push(tenant.tenant.id)
        return []
      } else {
        batchJobs.push({
          type: 'ONGOING_SCREENING_USER_RULE',
          tenantId: tenant.tenant.id,
        })
      }
      await Promise.all(batchJobs.map((job) => sendBatchJobCommand(job)))
      return batchJobs
    })
  )
  const mongoDb = await getMongoDbClient()
  const providers = await getTargetProviders(mongoDb)
  const batchJobCommands: Promise<void>[] = []
  for (const provider of providers) {
    const entityTypes = COLLECTIONS_MAP[provider]
    for (const entityType of entityTypes) {
      batchJobCommands.push(
        sendBatchJobCommand({
          type: 'SANCTIONS_DATA_FETCH',
          tenantId: 'flagright',
          providers: [provider],
          parameters: {
            from: dayjs().subtract(1, 'day').toISOString(),
            entityType: entityType,
          },
        })
      )
    }
  }
  await Promise.all([
    ...batchJobCommands,
    sendBatchJobCommand({
      type: 'DELTA_SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: providers,
      parameters: {
        from: dayjs().subtract(1, 'day').toISOString(),
        ongoingScreeningTenantIds: commonDataTenantIds,
      },
    }),
  ])

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
    await checkDormantUsers(tenantInfos, dynamoDb)
  } catch (e) {
    logger.error(`Failed to check dormant users: ${(e as Error)?.message}`, e)
  }

  await Promise.all(
    tenantInfos.map((tenant) => {
      try {
        return sendCaseCreatedAlert(tenant.tenant.id)
      } catch (e) {
        logger.error(
          `Failed to send case created alert: ${
            (e as Error)?.message
          } for tenant ${tenant.tenant.id}`,
          e
        )
      }
    })
  )

  if (envIs('dev')) {
    await sendBatchJobCommand({
      type: 'QA_CLEANUP',
      tenantId: FLAGRIGHT_TENANT_ID,
    })
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

async function clearTriageQueueTickets() {
  if (isQaEnv()) {
    return
  }

  const mongoDb = await getMongoDbClient()
  const collection = mongoDb
    .db()
    .collection<TriageQueueTicket>(TRIAGE_QUEUE_TICKETS_COLLECTION())

  await collection.deleteMany({})
}

async function checkDormantUsers(
  tenantInfos: TenantInfo[],
  dynamoDb: DynamoDBClient
) {
  for await (const tenant of tenantInfos) {
    const accountsService = new AccountsService(
      { auth0Domain: tenant.auth0Domain },
      { dynamoDb }
    )
    const tenantSettings = await new TenantRepository(tenant.tenant.id, {
      dynamoDb,
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
          await accountsService.blockAccount(
            tenant.tenant.id,
            account.id,
            'DORMANT'
          )
        }
      }
    }
  }
}

export async function updateOncallUsers() {
  const slack = await getSecret<{ token: string }>('slackCreds')
  const zendutyKey = await getSecret<{ apiKey: string }>('zenduty')
  const slackClient = new WebClient(slack.token)

  const ZENDUTY_TEAM_ID = '8609ccb8-52f0-4c4c-baf0-7aeaf624228a'
  const ONCALL_GROUPS: { name: string; groupId: string }[] = [
    { name: 'Engineering On Call', groupId: ENGINEERING_ON_CALL_GROUP_ID },
    { name: 'Customer On Call', groupId: CUSTOMER_ON_CALL_GROUP_ID },
  ]

  const schedulesResponse = await axios.get<
    { escalation_policy: { name: string }; users: { email: string }[] }[]
  >(`https://www.zenduty.com/api/account/teams/${ZENDUTY_TEAM_ID}/oncall/`, {
    headers: { Authorization: `Token ${zendutyKey.apiKey}` },
  })

  const slackUsers = await slackClient.users.list({ limit: 1000 })

  for (const { name, groupId } of ONCALL_GROUPS) {
    const oncallEmails = schedulesResponse.data
      .find((schedule) => schedule.escalation_policy.name === name)
      ?.users.map((user) => user.email)

    const oncallUsers = slackUsers.members?.filter((user) =>
      oncallEmails?.includes(user.profile?.email ?? '')
    )
    const oncallUserIds = compact(oncallUsers?.map((user) => user.id))

    const currentOncallSlackUsers = await slackClient.usergroups.users.list({
      usergroup: groupId,
    })

    const isOnCallUpdated = currentOncallSlackUsers.users?.some(
      (user) => !oncallUserIds.includes(user)
    )

    await slackClient.usergroups.users.update({
      usergroup: groupId,
      users: oncallUserIds.join(','),
    })

    if (isOnCallUpdated) {
      const slackUserNames = oncallUsers?.map((user) => user.profile?.real_name)

      await slackClient.chat.postMessage({
        channel: INCIDENTS_BUGS_CHANNEL_ID,
        text: `<!subteam^${ENGINEERING_GROUP_ID}> ${slackUserNames?.join(
          ', '
        )} is on call check on <!subteam^${groupId}>`,
      })
    }
  }
}
