import { MongoClient, MongoError } from 'mongodb'
import chunk from 'lodash/chunk'
import cloneDeep from 'lodash/cloneDeep'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { logger } from '../logger'
import { data as krsAndDrsScoreData } from './data/risk-scores'
import { getCases } from './data/cases'
import { getNotifications } from './data/notifications'
import { getArsScores } from './data/ars_scores'
import { getQASamples } from './samplers/qa-samples'
import { getSLAPolicies } from './data/sla'
import { getMlModels } from './data/ml-models'
import { getCounterCollectionData } from './data/counter'
import { getRandomRuleQueues } from './data/rule-queue'
import { getUserEvents } from './data/user_events'
import {
  allCollections,
  createGlobalMongoDBCollections,
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import {
  UNIQUE_TAGS_COLLECTION,
  CASES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  AUDITLOG_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  CRM_ENGAGEMENTS_COLLECTION,
  CRM_TASKS_COLLECTION,
  CRM_NOTES_COLLECTION,
  CRM_SUMMARY_COLLECTION,
  REPORT_COLLECTION,
  SIMULATION_TASK_COLLECTION,
  CHECKLIST_TEMPLATE_COLLECTION,
  COUNTER_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  ARS_SCORES_COLLECTION,
  ALERTS_QA_SAMPLING_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
  SLA_POLICIES_COLLECTION,
  ML_MODELS_COLLECTION,
  SANCTIONS_SCREENING_DETAILS_COLLECTION,
  RULE_QUEUES_COLLECTION,
  REASONS_COLLECTION,
  USER_EVENTS_COLLECTION,
  NARRATIVE_TEMPLATE_COLLECTION,
  JOBS_COLLECTION,
} from '@/utils/mongo-table-names'
import { allUniqueTags, getTransactions } from '@/core/seed/data/transactions'
import { users } from '@/core/seed/data/users'
import { auditlogs } from '@/core/seed/data/auditlogs'
import {
  getSanctions,
  getSanctionsHits,
  getSanctionsScreeningDetails,
} from '@/core/seed/data/sanctions'
import { reports } from '@/core/seed/data/reports'
import { getSimulations } from '@/core/seed/data/simulation'
import {
  getNotes,
  getEngagements,
  getTasks,
  getSummaries,
} from '@/core/seed/data/crm'
import { data as transactionEvents } from '@/core/seed/data/transaction_events'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { getChecklistTemplates } from '@/core/seed/data/checklists'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { CounterEntity, EntityCounter } from '@/services/counter/repository'
import { Case } from '@/@types/openapi-internal/Case'
import { Alert } from '@/@types/openapi-internal/Alert'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { getNonDemoTenantId } from '@/utils/tenant-id'
import { SLAService } from '@/services/sla/sla-service'
import { getDefaultReasonsData } from '@/services/tenants/reasons-service'
import { getNarrativeTemplates } from '@/core/seed/data/narrative'

const collections: [(tenantId: string) => string, () => unknown[]][] = [
  [TRANSACTIONS_COLLECTION, () => getTransactions()],
  [CASES_COLLECTION, () => getCases()],
  [USERS_COLLECTION, () => users],
  [USER_EVENTS_COLLECTION, () => getUserEvents()],
  [KRS_SCORES_COLLECTION, () => krsAndDrsScoreData()[0]],
  [AUDITLOG_COLLECTION, () => auditlogs()],
  [DRS_SCORES_COLLECTION, () => krsAndDrsScoreData()[1]],
  [TRANSACTION_EVENTS_COLLECTION, () => transactionEvents()],
  [SANCTIONS_SEARCHES_COLLECTION, () => getSanctions()],
  [SANCTIONS_HITS_COLLECTION, () => getSanctionsHits()],
  [
    SANCTIONS_SCREENING_DETAILS_COLLECTION,
    () => getSanctionsScreeningDetails(),
  ],
  [REPORT_COLLECTION, () => reports],
  [CRM_ENGAGEMENTS_COLLECTION, () => getEngagements()],
  [CRM_TASKS_COLLECTION, () => getTasks()],
  [CRM_NOTES_COLLECTION, () => getNotes()],
  [CRM_SUMMARY_COLLECTION, () => getSummaries()],
  [SIMULATION_TASK_COLLECTION, () => getSimulations()],
  [CHECKLIST_TEMPLATE_COLLECTION, () => getChecklistTemplates()],
  [NARRATIVE_TEMPLATE_COLLECTION, () => getNarrativeTemplates()],
  [NOTIFICATIONS_COLLECTION, () => getNotifications()],
  [ARS_SCORES_COLLECTION, () => getArsScores()],
  [ALERTS_QA_SAMPLING_COLLECTION, () => getQASamples()],
  [SLA_POLICIES_COLLECTION, () => getSLAPolicies()],
  [ML_MODELS_COLLECTION, () => getMlModels()],
  [UNIQUE_TAGS_COLLECTION, () => allUniqueTags()],
  [RULE_QUEUES_COLLECTION, () => getRandomRuleQueues()],
  [REASONS_COLLECTION, () => getDefaultReasonsData()],
]

const skipCollections = (tenantId: string) => [JOBS_COLLECTION(tenantId)]

export async function seedMongo(
  tenantId: string,
  client: MongoClient,
  dynamoDb: DynamoDBDocumentClient
) {
  logger.info('Seeding MongoDB...')
  const db = client.db()
  const originalTenantId = getNonDemoTenantId(tenantId)
  const tenantRepository = new TenantRepository(originalTenantId, {
    mongoDb: client,
    dynamoDb: getDynamoDbClient(),
  })

  const settings = await tenantRepository.getTenantSettings(['auth0Domain'])
  const auth0Domain =
    settings.auth0Domain || (process.env.AUTH0_DOMAIN as string)

  let now = Date.now()
  try {
    logger.info('Get all collections')
    const col = await allCollections(tenantId, db)
    logger.info('Truncating collections')

    await Promise.allSettled(
      col
        .filter((c) => !skipCollections(tenantId).includes(c))
        .map((c) => db.collection(c).deleteMany({}))
    )
  } catch (e) {
    logger.info("Couldn't empty collections")
  }
  logger.info(`TIME: MongoDB: Collections deletion took ~ ${Date.now() - now}`)

  now = Date.now()
  await createMongoDBCollections(client, dynamoDb, tenantId)
  logger.info(`TIME: MongoDB: Collections creation took ~ ${Date.now() - now}`)
  now = Date.now()
  await createGlobalMongoDBCollections(client)
  logger.info(
    `TIME: MongoDB: Global collections creation took, ${Date.now() - now}`
  )

  logger.info('Setting counters')
  const counterCollection = db.collection<EntityCounter>(
    COUNTER_COLLECTION(tenantId)
  )

  const counters: [CounterEntity, number][] = getCounterCollectionData(tenantId)
  now = Date.now()
  for (const counter of counters) {
    await counterCollection.findOneAndUpdate(
      { entity: counter[0] },
      { $set: { count: counter[1] } },
      { upsert: true, returnDocument: 'after' }
    )
  }
  logger.info(`TIME: MongoDB: Counters creation took ~ ${Date.now() - now}`)

  now = Date.now()
  await db.collection(ML_MODELS_COLLECTION()).deleteMany({})
  logger.info(`TIME: MongoDB: ML models deletion took ~ ${Date.now() - now}`)

  logger.info('Creating collections')
  for (const [collectionNameFn, data] of collections) {
    if (skipCollections(tenantId).includes(collectionNameFn(tenantId))) {
      continue
    }

    const collection = db.collection(collectionNameFn(tenantId) as string)
    const collectionData = data()
    const clonedData = cloneDeep(collectionData)

    now = Date.now()
    for await (const dataChunk of chunk(clonedData, 10000)) {
      try {
        await collection.insertMany(dataChunk as any[], { ordered: false })
      } catch (error) {
        if ((error as MongoError).code === 11000) {
          // Ignore duplicate key errors
        } else {
          throw error
        }
      }
    }
    logger.info(
      `TIME: MongoDB: ${collectionNameFn(tenantId)} insertion took ~ ${
        Date.now() - now
      }`
    )
    logger.info(
      `Re-created collection: ${collectionNameFn(tenantId)} - ${
        clonedData.length
      } records`
    )
  }

  logger.info('Update transaction with alertIds')
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const cases = await casesCollection.find().toArray()
  const alerts = cases
    .flatMap((case_) => case_.alerts)
    .filter(Boolean) as Alert[]
  const mongoDb = await getMongoDbClient()
  const transactionRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb,
    dynamoDb
  )

  for (const alert of alerts) {
    for (const txChunk of chunk(alert.transactionIds, 500)) {
      if (alert.alertId) {
        await transactionRepository.updateTransactionAlertIds(txChunk, [
          alert.alertId,
        ])
      }
    }
  }
  logger.info(
    `TIME: MongoDB: Updating transaction with alertIds took ~ ${
      Date.now() - now
    }`
  )

  logger.info('Refreshing dashboard stats...')
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb: client,
    dynamoDb,
  })
  now = Date.now()

  await dashboardStatsRepository.refreshAllStats()
  logger.info(
    `TIME: MongoDB: Refreshing dashboard stats took ~ ${Date.now() - now}`
  )
  logger.info('Dashboard stats refreshed')

  logger.info('Updating alerts SLA statuses')

  const alertsSLAService = new SLAService(tenantId, auth0Domain, {
    mongoDb: client,
    dynamoDb,
  })

  now = Date.now()
  await alertsSLAService.calculateAndUpdateSLAStatusesForAlerts()
  logger.info(
    `TIME: MongoDB: Updating alerts SLA statuses took ~ ${Date.now() - now}`
  )

  logger.info('Alerts SLA statuses updated')
}
