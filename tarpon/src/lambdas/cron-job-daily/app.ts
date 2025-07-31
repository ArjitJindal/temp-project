import { compact } from 'lodash'
import { FlagrightRegion, Stage } from '@flagright/lib/constants/deploy'
import { isQaEnv } from '@flagright/lib/qa'
import { WebClient } from '@slack/web-api'
import axios from 'axios'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import slackify from 'slackify-markdown'
import { MongoClient } from 'mongodb'
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
import {
  TRANSACTIONS_COLLECTION,
  TRIAGE_QUEUE_TICKETS_COLLECTION,
} from '@/utils/mongodb-definitions'
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
import {
  executeClickhouseQuery,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import { isDemoTenant } from '@/utils/tenant'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { createApiUsageJobs } from '@/utils/api-usage'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { BatchRerunUsersService } from '@/services/batch-users-rerun'

export const cronJobDailyHandler = lambdaConsumer()(async () => {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  if (envIs('dev')) {
    try {
      await clearTriageQueueTickets(mongoDb)
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

  try {
    await Promise.all(
      tenantInfos.map(async (tenant) => {
        try {
          return await rerunRiskScoring(tenant.tenant.id, { dynamoDb, mongoDb })
        } catch (e) {
          logger.error(
            `Failed to rerun risk scoring for tenant ${tenant.tenant.id}: ${
              (e as Error)?.message
            }`,
            e
          )
        }
      })
    )
  } catch (e) {
    logger.error(`Failed to rerun risk scoring: ${(e as Error)?.message}`, e)
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

  try {
    if (!envIs('prod')) {
      return
    }

    const diffPercentageMap = new Map<
      string,
      { monthly?: number; daily?: number }
    >()
    for (const tenant of tenantInfos) {
      await transactionsDeviationAlert(
        tenant.tenant.id,
        diffPercentageMap,
        mongoDb
      )
    }
    if (diffPercentageMap.size > 0) {
      await sendTransactionsDeviationAlert(diffPercentageMap, tenantInfos)
    }
  } catch (e) {
    logger.error(
      `Failed to check transactions deviation: ${(e as Error)?.message}`,
      e
    )
  }
})

async function clearTriageQueueTickets(mongoDb: MongoClient) {
  if (isQaEnv()) {
    return
  }

  const collection = mongoDb
    .db()
    .collection<TriageQueueTicket>(TRIAGE_QUEUE_TICKETS_COLLECTION())

  await collection.deleteMany({})
}

async function checkDormantUsers(
  tenantInfos: TenantInfo[],
  dynamoDb: DynamoDBDocumentClient
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
            { tenantId: tenant.tenant.id, orgName: tenant.tenant.orgName },
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

const getClickhouseTransactionsCount = async (
  tenantId: string,
  timestamps: { start: number; end: number }
) => {
  const transactions = await executeClickhouseQuery<{ count: number }>(
    tenantId,
    `SELECT count() as count FROM transactions
    WHERE timestamp >= ${timestamps.start} AND timestamp <= ${timestamps.end}
  `
  )
  return transactions[0].count
}

const getMongoTransactionsCount = async (
  collection: any,
  start: number,
  end: number
) => {
  return collection.countDocuments({
    createdAt: { $gte: start, $lte: end },
  })
}

const calculatePercentage = (
  count1: number,
  count2: number,
  threshold: number
) => {
  if (count1 < count2 * threshold) {
    return (count1 / count2) * 100
  }
  return undefined
}

export async function transactionsDeviationAlert(
  tenantId: string,
  diffPercentageMap: Map<string, { monthly?: number; daily?: number }>,
  mongoDb: MongoClient
) {
  if (isDemoTenant(tenantId)) {
    return
  }
  let dailyPercentage: number | undefined
  let monthlyPercentage: number | undefined

  const now = dayjs().valueOf()
  const oneDayAgo = dayjs().subtract(1, 'day').valueOf()
  const twoDaysAgo = dayjs().subtract(2, 'day').valueOf()
  const oneMonthAgo = dayjs().subtract(1, 'month').valueOf()
  const twoMonthsAgo = dayjs().subtract(2, 'month').valueOf()

  if (isClickhouseEnabledInRegion()) {
    const monthCount1 = await getClickhouseTransactionsCount(tenantId, {
      start: twoMonthsAgo,
      end: oneMonthAgo,
    })
    const monthCount2 = await getClickhouseTransactionsCount(tenantId, {
      start: oneMonthAgo,
      end: now,
    })
    monthlyPercentage = calculatePercentage(monthCount1, monthCount2, 0.8)

    const dayCount1 = await getClickhouseTransactionsCount(tenantId, {
      start: twoDaysAgo,
      end: oneDayAgo,
    })
    const dayCount2 = await getClickhouseTransactionsCount(tenantId, {
      start: oneDayAgo,
      end: now,
    })
    dailyPercentage = calculatePercentage(dayCount1, dayCount2, 0.7)
  } else {
    const transactionsCollection = mongoDb
      .db()
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))

    const monthCount1 = await getMongoTransactionsCount(
      transactionsCollection,
      twoMonthsAgo,
      now
    )
    const monthCount2 = await getMongoTransactionsCount(
      transactionsCollection,
      oneMonthAgo,
      now
    )
    monthlyPercentage = calculatePercentage(monthCount1, monthCount2, 0.8)

    const dayCount1 = await getMongoTransactionsCount(
      transactionsCollection,
      twoDaysAgo,
      oneDayAgo
    )
    const dayCount2 = await getMongoTransactionsCount(
      transactionsCollection,
      oneDayAgo,
      now
    )
    dailyPercentage = calculatePercentage(dayCount1, dayCount2, 0.7)
  }

  if (monthlyPercentage || dailyPercentage) {
    diffPercentageMap.set(tenantId, {
      ...(monthlyPercentage && { monthly: monthlyPercentage }),
      ...(dailyPercentage && { daily: dailyPercentage }),
    })
  }
}

async function sendTransactionsDeviationAlert(
  diffPercentageMap: Map<string, { monthly?: number; daily?: number }>,
  tenants: TenantInfo[]
) {
  const slack = await getSecret<{ token: string }>('slackCreds')
  const slackClient = new WebClient(slack.token)

  const slackMessage = Array.from(diffPercentageMap.entries())
    .filter(([tenantId]) => {
      const tenant = tenants.find((tenant) => tenant.tenant.id === tenantId)
      return !tenant?.tenant.name.toLowerCase().includes('flagright')
    })
    .map(([tenantId]) => {
      const tenant = tenants.find((tenant) => tenant.tenant.id === tenantId)
      return `Tenant ${tenantId}
        ${tenant?.tenant.name} (${tenantId})
        ${
          diffPercentageMap.get(tenantId)?.monthly
            ? `${diffPercentageMap.get(tenantId)?.monthly}% monthly`
            : ''
        } ${
        diffPercentageMap.get(tenantId)?.daily
          ? `${diffPercentageMap.get(tenantId)?.daily}% daily`
          : ''
      } deviation`
    })
    .join('\n')

  if (diffPercentageMap.size === 0) {
    return
  }

  await slackClient.chat.postMessage({
    channel: INCIDENTS_BUGS_CHANNEL_ID,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Transactions Deviation Alert' },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hey <!subteam^${CUSTOMER_ON_CALL_GROUP_ID}> we have detected a deviation in the transactions for the following tenants:`,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: slackify(slackMessage) },
      },
    ],
  })
}

async function rerunRiskScoring(
  tenantId: string,
  connections: { dynamoDb: DynamoDBClient; mongoDb: MongoClient }
) {
  const tenantService = new TenantService(tenantId, connections)
  const settings = await tenantService.getTenantSettings()
  if (
    !settings.features?.includes('RISK_SCORING') ||
    settings.riskScoringAlgorithm?.type === 'FORMULA_LEGACY_MOVING_AVG'
  ) {
    logger.info(
      `Skipping risk scoring rerun for tenant ${tenantId} because it is not enabled or using legacy moving average algorithm`
    )
    return
  }

  const frequency = settings.batchRerunRiskScoringFrequency || 'DISABLED'
  if (frequency === 'DISABLED') {
    logger.info(
      `Skipping risk scoring rerun for tenant ${tenantId} because it is disabled`
    )
    return
  }

  const riskRepository = new RiskRepository(tenantId, connections)
  const batchJobRepository = new BatchJobRepository(
    tenantId,
    connections.mongoDb
  )

  const [consumerRiskFactors, businessRiskFactors] = await Promise.all([
    riskRepository.getAllRiskFactors('CONSUMER_USER'),
    riskRepository.getAllRiskFactors('BUSINESS'),
  ])

  const lastUpdated = [...consumerRiskFactors, ...businessRiskFactors].reduce(
    (acc, riskFactor) => {
      return Math.max(acc, riskFactor.updatedAt ?? riskFactor.createdAt ?? 0)
    },
    0
  )

  const lastRerun = await batchJobRepository.getLatestJob({
    type: 'BATCH_RERUN_USERS',
    'parameters.jobType': 'RERUN_RISK_SCORING',
    'latestStatus.status': { $in: ['PENDING', 'IN_PROGRESS', 'SUCCESS'] },
  })

  const now = dayjs()
  const lastUpdatedDate = dayjs(lastUpdated)
  const lastRerunDate = lastRerun?.latestStatus?.scheduledAt
    ? dayjs(lastRerun.latestStatus.scheduledAt)
    : null

  let shouldRerun = false

  switch (frequency) {
    case 'DAILY':
      // For daily rerun: check if risk factors have been updated since last rerun
      shouldRerun = !lastRerunDate || lastUpdatedDate.isAfter(lastRerunDate)
      break

    case 'WEEKLY':
      // only run on first day of the week and check if risk factors were updated since last rerun
      shouldRerun =
        now.day() === 1 &&
        (!lastRerunDate || lastUpdatedDate.isAfter(lastRerunDate))
      break

    case 'MONTHLY':
      // only run on first day of the month and check if risk factors were updated since last rerun
      shouldRerun =
        now.date() === 1 &&
        (!lastRerunDate || lastUpdatedDate.isAfter(lastRerunDate))
      break

    default:
      shouldRerun = false
  }

  if (shouldRerun) {
    logger.info(
      `Triggering risk scoring rerun for tenant ${tenantId} with frequency ${frequency}`
    )

    const batchRunnerService = new BatchRerunUsersService(tenantId, connections)
    const status = await batchRunnerService.toRerunRiskScoring()
    if (status.isError) {
      logger.error(
        `Failed to rerun risk scoring for tenant ${tenantId}: ${status.error}`
      )
      return
    }

    await sendBatchJobCommand({
      type: 'BATCH_RERUN_USERS',
      tenantId,
      parameters: {
        jobType: 'RERUN_RISK_SCORING',
      },
    })
  } else {
    logger.info(
      `Skipping risk scoring rerun for tenant ${tenantId} with frequency ${frequency} - conditions not met`
    )
  }
}
