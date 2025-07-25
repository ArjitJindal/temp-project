import { Stage } from '@flagright/lib/constants/deploy'
import { LinearClient } from '@linear/sdk'
import { WebClient } from '@slack/web-api'
import { isQaEnv } from '@flagright/lib/qa'
import slackifyMarkdown from 'slackify-markdown'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TenantService } from '@/services/tenants'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { logger } from '@/core/logger'
import dayjs from '@/utils/dayjs'
import { CurrencyService } from '@/services/currency'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { tenantHasFeature } from '@/core/utils/context'
import { WebhookRetryRepository } from '@/services/webhook/repositories/webhook-retry-repository'
import {
  getTimeFromRegion,
  JobRunConfig,
  shouldRun,
} from '@/utils/sla-scheduler'
import { SLAService } from '@/services/sla/sla-service'
import { envIs } from '@/utils/env'
import { getSecret } from '@/utils/secrets-manager'
import { TRIAGE_QUEUE_TICKETS_COLLECTION } from '@/utils/mongodb-definitions'
import { TriageQueueTicket } from '@/@types/triage'
import {
  ENGINEERING_HELP_CHANNEL_ID,
  ENGINEERING_ON_CALL_GROUP_ID,
} from '@/utils/slack'
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'
import {
  skippedTenantsClickhouseCheckForDashboardRefresh,
  handleBatchJobTrigger,
} from '@/utils/cron'
import { runSanctionsDataCountJob } from '@/services/sanctions/sanctions-data-count'
import { isDemoTenant } from '@/utils/tenant'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import {
  getOpensearchClient,
  isOpensearchAvailableInRegion,
  keepAlive,
} from '@/utils/opensearch-utils'

const batchJobScheduler5Hours10Minutes: JobRunConfig = {
  windowStart: 18,
  windowEnd: 9,
  runIntervalInHours: 5,
  checkCallInterval: 10,
  shouldRunWhenOutsideWindow: true,
} // runs job at interval of 5 hours, check for running condition every 10 minutes. If the time is outside the run window it runs with different frequency

async function handleDashboardRefreshBatchJob(tenantIds: string[]) {
  try {
    const now = dayjs()
    const checkTimeRange = {
      // NOTE: Make the time window to be larger then the cron frequency to avoid gaps
      startTimestamp: now.subtract(30, 'minute').valueOf(),
      endTimestamp: now.valueOf(),
    }
    await Promise.all(
      tenantIds.map(async (tenantId) => {
        if (await tenantHasFeature(tenantId, 'MANUAL_DASHBOARD_REFRESH')) {
          return
        }
        const skippedTenants =
          skippedTenantsClickhouseCheckForDashboardRefresh[
            process.env.ENV as Stage
          ] ?? []
        if (isClickhouseEnabled() && !skippedTenants?.includes(tenantId)) {
          return
        }
        return sendBatchJobCommand({
          type: 'DASHBOARD_REFRESH',
          tenantId,
          parameters: {
            checkTimeRange,
          },
        })
      })
    )
  } catch (e) {
    logger.error(
      `Failed to send dashboard refresh batch jobs: ${(e as Error)?.message}`,
      e
    )
  }
}

async function handleSlaStatusCalculationBatchJob(tenantIds: string[]) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()

  try {
    await Promise.all(
      tenantIds.map(async (id) => {
        const tenantService = new TenantService(id, { mongoDb, dynamoDb })
        const features = (await tenantService.getTenantSettings()).features
        if (features?.includes('ALERT_SLA')) {
          const slaService = new SLAService(id, '', {
            mongoDb,
            dynamoDb,
          })
          await slaService.handleSendingSlaRefreshJobs()
        }
        if (features?.includes('PNB')) {
          await sendBatchJobCommand({
            type: 'CASE_SLA_STATUS_REFRESH',
            tenantId: id,
          })
        }
      })
    )
  } catch (e) {
    logger.error(
      `Failed to send SLA status calculation batch jobs: ${
        (e as Error)?.message
      }`,
      e
    )
  }
}

export const cronJobTenMinuteHandler = lambdaConsumer()(async () => {
  try {
    const now = getTimeFromRegion()
    const dynamoDb = getDynamoDbClient()
    const mongoDbClient = await getMongoDbClient()
    const currencyService = new CurrencyService(dynamoDb)
    // Hack to ensure we query the currency data for viper.
    await currencyService.getCurrencyExchangeRate('USD', 'EUR')
    const tenantIds = await TenantService.getAllTenantIds()
    await handleDashboardRefreshBatchJob(tenantIds)

    if (shouldRun(batchJobScheduler5Hours10Minutes, now)) {
      await handleSlaStatusCalculationBatchJob(tenantIds)
    }

    let hasAcurisFeature = false
    let hasOpenSanctionsFeature = false

    for (const tenantId of tenantIds) {
      if (isDemoTenant(tenantId)) {
        continue
      }

      if (!hasAcurisFeature) {
        hasAcurisFeature = await tenantHasFeature(tenantId, 'ACURIS')
      }

      if (!hasOpenSanctionsFeature) {
        hasOpenSanctionsFeature = await tenantHasFeature(
          tenantId,
          'OPEN_SANCTIONS'
        )
      }

      // Break early if both features are found
      if (hasAcurisFeature && hasOpenSanctionsFeature) {
        break
      }
    }
    if (hasAcurisFeature) {
      await runSanctionsDataCountJob(
        SanctionsDataProviders.ACURIS,
        mongoDbClient
      )
    }
    if (hasOpenSanctionsFeature) {
      await runSanctionsDataCountJob(
        SanctionsDataProviders.OPEN_SANCTIONS,
        mongoDbClient
      )
    }
    await handleBatchJobTrigger(tenantIds, [
      'RISK_SCORING_RECALCULATION',
      'USER_RULE_RE_RUN',
    ])
    await deleteOldWebhookRetryEvents(tenantIds)

    if (envIs('dev')) {
      try {
        await notifyTriageIssues()
      } catch (e) {
        logger.error(
          `Failed to notify triage issues: ${(e as Error)?.message}`,
          e
        )
      }
    }
    if (isOpensearchAvailableInRegion()) {
      const opensearchClient = await getOpensearchClient()
      await keepAlive(opensearchClient)
    }
  } catch (error) {
    logger.error('Error in 10 minute cron job handler', error)
    throw error
  }
})

async function deleteOldWebhookRetryEvents(tenantIds: string[]) {
  const mongoDb = await getMongoDbClient()
  try {
    await Promise.all(
      tenantIds.map(async (tenantId) => {
        const webhookRetryRepository = new WebhookRetryRepository(
          tenantId,
          mongoDb
        )
        const count = await webhookRetryRepository.countWebhookRetryEvents()

        if (count) {
          await sendBatchJobCommand({ type: 'WEBHOOK_RETRY', tenantId })
        }
      })
    )
  } catch (e) {
    logger.error(
      `Failed to delete old webhook retry events: ${(e as Error)?.message}`,
      e
    )
  }
}

export async function notifyTriageIssues() {
  if (isQaEnv()) {
    return
  }
  // only run between 7AM IST to 11PM IST
  const now = dayjs().tz('Asia/Kolkata')
  if (now.hour() <= 7 || now.hour() >= 23) {
    return
  }

  const linear = await getSecret<{ apiKey: string }>('linear')
  const slack = await getSecret<{ token: string }>('slackCreds')
  const mongoDb = await getMongoDbClient()
  const collection = mongoDb
    .db()
    .collection<TriageQueueTicket>(TRIAGE_QUEUE_TICKETS_COLLECTION())

  const triageQueueTicketsAlreadyNotified = await collection
    .find({
      notifiedAt: { $gte: dayjs().subtract(4, 'hour').valueOf() },
    })
    .toArray()

  const linearClient = new LinearClient({
    apiKey: linear.apiKey,
  })

  const slackClient = new WebClient(slack.token)

  const states = await linearClient.workflowStates({
    filter: {
      name: { eq: 'Triage' },
    },
  })

  const issuesResponse = await linearClient.issues({
    filter: {
      state: { id: { eq: states.nodes[0].id } },
      priority: { eq: 1 },
    },
  })

  const issues: TriageQueueTicket[] = issuesResponse.nodes.map((issue) => ({
    identifier: issue.identifier,
    title: issue.title,
    priority: issue.priority,
    url: `https://linear.app/flagright/issue/${issue.identifier}`,
    createdTimestamp: dayjs(issue.createdAt).valueOf(),
    notifiedAt: Date.now(),
  }))

  const issuesToNotify = issues.filter((issue) => {
    const isAlreadyNotified = triageQueueTicketsAlreadyNotified.some(
      (ticket) => ticket.identifier === issue.identifier
    )

    return !isAlreadyNotified
  })

  const headerText = `Hey <!subteam^${ENGINEERING_ON_CALL_GROUP_ID}>! Here are the pending issues in triage queue marked as **Urgent**. Please pick them as soon as possible.`

  const issueText = issuesToNotify
    .map(
      (issue, index) =>
        `*${index + 1}.* ${issue.title} ([${issue.identifier}](${issue.url}))`
    )
    .join('\n')

  if (!issuesToNotify.length) {
    return
  }

  const slackResponse = await slackClient.chat.postMessage({
    channel: ENGINEERING_HELP_CHANNEL_ID,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: slackifyMarkdown(headerText) },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: slackifyMarkdown(issueText) },
      },
    ],
  })

  if (slackResponse.ok) {
    await Promise.all(
      issuesToNotify.map(async (issue) => {
        await collection.replaceOne(
          { identifier: issue.identifier },
          { ...issue, notifiedAt: dayjs().valueOf() },
          { upsert: true }
        )
      })
    )
  }
}
