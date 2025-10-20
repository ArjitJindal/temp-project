import { Stage } from '@flagright/lib/constants/deploy'
import { LinearClient } from '@linear/sdk'
import { WebClient } from '@slack/web-api'
import { isQaEnv } from '@flagright/lib/qa'
import slackifyMarkdown from 'slackify-markdown'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { ListObjectsCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
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
import { envIs, envIsNot } from '@/utils/env'
import { getSecret } from '@/utils/secrets-manager'
import { TRIAGE_QUEUE_TICKETS_COLLECTION } from '@/utils/mongo-table-names'
import { TriageQueueTicket } from '@/@types/triage'
import {
  ENGINEERING_HELP_CHANNEL_ID,
  ENGINEERING_ON_CALL_GROUP_ID,
  TEST_SLACK_CHANNEL_ID,
} from '@/utils/slack'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import {
  skippedTenantsClickhouseCheckForDashboardRefresh,
  handleBatchJobTrigger,
} from '@/utils/cron'
import { runSanctionsDataCountJob } from '@/services/sanctions/sanctions-data-count'
import { isDemoTenant } from '@/utils/tenant-id'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import {
  getOpensearchClient,
  isOpensearchAvailableInRegion,
  keepAlive,
} from '@/utils/opensearch-utils'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { ScreeningProfileRepository } from '@/services/screening-profile/repositories/screening-profile-repository'
import { getS3Client } from '@/utils/s3'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
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

async function handleCraLockUntimerBatchJob(tenantIds: string[]) {
  try {
    // Filter tenant IDs to only include those with CRA_LOCK_TIMER feature enabled
    const tenantsWithCraLockTimer: string[] = []

    for (const tenantId of tenantIds) {
      if (isDemoTenant(tenantId)) {
        continue // Skip demo tenants for batch jobs
      }

      const hasCraLockTimerFeature = await tenantHasFeature(
        tenantId,
        'CRA_LOCK_TIMER'
      )
      if (hasCraLockTimerFeature) {
        tenantsWithCraLockTimer.push(tenantId)
      }
    }

    if (tenantsWithCraLockTimer.length === 0) {
      logger.info(
        'No tenants have CRA_LOCK_TIMER feature enabled, skipping all CRA lock untimer batch jobs'
      )
      return
    }

    logger.info(
      `Scheduling CRA lock untimer batch jobs for ${tenantsWithCraLockTimer.length} tenants with CRA_LOCK_TIMER feature`
    )

    await Promise.all(
      tenantsWithCraLockTimer.map(async (tenantId) => {
        return sendBatchJobCommand({
          type: 'CRA_LOCK_UNTIMER',
          tenantId,
        })
      })
    )
  } catch (e) {
    logger.error(
      `Failed to send CRA lock untimer batch jobs: ${(e as Error)?.message}`,
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
    await handleCraLockUntimerBatchJob(tenantIds)
    await deleteOldWebhookRetryEvents(tenantIds)
    await dispatchScreeningDataFetchJob(dynamoDb)

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

    if (now.minute() % 20 < 10) {
      try {
        logger.info(
          'Triggering GoCardless backfill batch job at 20 minute interval'
        )
        await triggerGoCardlessBackfillBatchJob(mongoDbClient)
      } catch (e) {
        logger.error(
          `Failed to trigger GoCardless backfill batch job: ${
            (e as Error)?.message
          }`,
          e
        )
      }
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

async function dispatchScreeningDataFetchJob(dynamoDb: DynamoDBDocumentClient) {
  if (envIsNot('prod')) {
    return
  }
  const tenantIds = await TenantService.getAllTenantIds()
  const tenantIdsToDispatch: string[] = []
  for (const tenantId of tenantIds) {
    const tenantRepository = new TenantRepository(tenantId, {
      dynamoDb,
    })
    const settings = await tenantRepository.getTenantSettings()
    if (settings.sanctions?.aggregateScreeningProfileData) {
      const screeningProfileRepository = new ScreeningProfileRepository(
        tenantId,
        dynamoDb
      )
      const screeningProfiles =
        await screeningProfileRepository.getScreeningProfiles()
      if (
        screeningProfiles.items.length > 0 &&
        screeningProfiles.items.some(
          (sp) =>
            sp.updatedAt &&
            dayjs(sp.updatedAt).isAfter(dayjs().subtract(10, 'minutes'))
        )
      ) {
        tenantIdsToDispatch.push(tenantId)
      }
    }
  }
  if (tenantIdsToDispatch.length > 0) {
    await sendBatchJobCommand({
      type: 'SCREENING_PROFILE_DATA_FETCH',
      tenantId: 'flagright',
      parameters: {
        provider: SanctionsDataProviders.ACURIS,
        entityType: 'PERSON',
        type: 'full',
        tenantIds: tenantIdsToDispatch,
      },
    })
    await sendBatchJobCommand({
      type: 'SCREENING_PROFILE_DATA_FETCH',
      tenantId: 'flagright',
      parameters: {
        provider: SanctionsDataProviders.ACURIS,
        entityType: 'BUSINESS',
        type: 'full',
        tenantIds: tenantIdsToDispatch,
      },
    })
  }
}

type TempGoCardlessBackfillDocument = {
  fileName: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  jobId: string
}

export async function triggerGoCardlessBackfillBatchJob(mongoDb: MongoClient) {
  if (envIsNot('prod') && process.env.REGION !== 'eu-2') {
    logger.info(
      'Skipping GoCardless backfill batch job in non-production environment'
    )
    return
  }

  logger.info('Triggered GoCardless backfill batch job')

  const MAX_FILES_PER_RUN = 2
  const slack = await getSecret<{ token: string }>('slackCreds')
  const slackClient = new WebClient(slack.token)
  const tenantId = '4c9cdf0251'
  const tempCollection = mongoDb
    .db()
    .collection<TempGoCardlessBackfillDocument>('temp_gocardless_backfill')

  const s3Client = getS3Client()

  let nextContinuationToken: string | undefined = undefined
  const files: { Key: string; LastModified: Date }[] = []

  do {
    const response = await s3Client.send(
      new ListObjectsCommand({
        Bucket: 'flagright-gocardless-data',
        Prefix: 'production_data/',
        Marker: nextContinuationToken,
        MaxKeys: 1000,
      })
    )
    files.push(
      ...(response.Contents?.map((object) => ({
        Key: object.Key as string,
        LastModified: object.LastModified as Date,
      })) ?? [])
    )
    nextContinuationToken = response.NextMarker
  } while (nextContinuationToken)

  if (files.length === 0) {
    return
  }

  // ascending order by LastModified
  files.sort((a, b) => a.LastModified.getTime() - b.LastModified.getTime())

  const alreadyProcessedFiles = await tempCollection.find({}).toArray()
  const alreadyProcessedFilesNames = alreadyProcessedFiles.map(
    (file) => file.fileName
  )
  const filesToProcess = files.filter(
    (file) => !alreadyProcessedFilesNames.includes(file.Key)
  )
  const slicedFiles = filesToProcess.slice(0, MAX_FILES_PER_RUN)
  for (const file of slicedFiles) {
    const generatedJobId = uuidv4()
    await sendBatchJobCommand(
      {
        type: 'BACKFILL_ENTITIES_JSONL',
        tenantId,
        parameters: {
          importFileS3Key: file.Key,
          type: 'TRANSACTION',
          dynamoDbOnly: true,
          bucket: 'flagright-gocardless-data',
        },
      },
      generatedJobId
    )

    await tempCollection.updateOne(
      { fileName: file.Key },
      { $set: { status: 'PENDING', jobId: generatedJobId } },
      { upsert: true }
    )
  }

  // inform on slack
  if (slackClient) {
    await slackClient.chat.postMessage({
      channel: TEST_SLACK_CHANNEL_ID,
      text: `Triggered GoCardless backfill batch job for ${slicedFiles.length} files`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: slackifyMarkdown(
              `Triggered GoCardless backfill batch job for ${
                slicedFiles.length
              } files:\n${slicedFiles
                .map((file, idx) => `${idx + 1}. \`${file.Key}\``)
                .join('\n')}`
            ),
          },
        },
      ],
    })
  }

  const pendingTempJobs = await tempCollection
    .find({ status: 'PENDING' })
    .toArray()

  const batchJobRepository = new BatchJobRepository(tenantId, mongoDb)

  const completedJobs: string[] = []
  for (const job of pendingTempJobs) {
    const batchJob = await batchJobRepository.getJobById(job.jobId)
    if (
      batchJob?.latestStatus.status === 'SUCCESS' &&
      batchJob.type === 'BACKFILL_ENTITIES_JSONL'
    ) {
      await tempCollection.updateOne(
        { fileName: batchJob.parameters.importFileS3Key },
        { $set: { status: 'COMPLETED' } }
      )
      completedJobs.push(job.fileName)
    }
  }

  if (completedJobs.length > 0) {
    await slackClient.chat.postMessage({
      channel: TEST_SLACK_CHANNEL_ID,
      text: `Completed GoCardless backfill batch job for ${completedJobs.length} files`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: slackifyMarkdown(
              `Completed GoCardless backfill batch job for ${
                completedJobs.length
              } files: ${completedJobs.map((file) => `\`${file}\``).join(', ')}`
            ),
          },
        },
      ],
    })
  }
}
