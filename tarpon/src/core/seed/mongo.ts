import { Document, MongoClient, MongoError, WithId } from 'mongodb'
import { chunk, cloneDeep } from 'lodash'
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
import { riskFactors } from './data/risk-factors'
import { getUserEvents } from './data/user_events'
import {
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import {
  allCollections,
  createGlobalMongoDBCollections,
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'
import {
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
  UNIQUE_TAGS_COLLECTION,
  RULE_QUEUES_COLLECTION,
  REASONS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { allUniqueTags, getTransactions } from '@/core/seed/data/transactions'
import { users } from '@/core/seed/data/users'
import { auditlogs } from '@/core/seed/data/auditlogs'
import {
  getSanctions,
  getSanctionsHits,
  getSanctionsScreeningDetails,
} from '@/core/seed/data/sanctions'
import { getReports } from '@/core/seed/data/reports'
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
import { getNonDemoTenantId } from '@/utils/tenant'
import { SLAService } from '@/services/sla/sla-service'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import {
  batchInsertToClickhouse,
  createTenantDatabase,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'
import {
  DEFAULT_CLOSURE_REASONS,
  DEFAULT_ESCALATION_REASONS,
  getDefaultReasonsData,
} from '@/services/tenants/reasons-service'

const collections: [(tenantId: string) => string, () => unknown[]][] = [
  [TRANSACTIONS_COLLECTION, () => getTransactions()],
  [CASES_COLLECTION, () => getCases()],
  [COUNTER_COLLECTION, () => getCounterCollectionData()],
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
  [REPORT_COLLECTION, () => getReports()],
  [CRM_ENGAGEMENTS_COLLECTION, () => getEngagements()],
  [CRM_TASKS_COLLECTION, () => getTasks()],
  [CRM_NOTES_COLLECTION, () => getNotes()],
  [CRM_SUMMARY_COLLECTION, () => getSummaries()],
  [SIMULATION_TASK_COLLECTION, () => getSimulations()],
  [CHECKLIST_TEMPLATE_COLLECTION, () => getChecklistTemplates()],
  [NOTIFICATIONS_COLLECTION, () => getNotifications()],
  [ARS_SCORES_COLLECTION, () => getArsScores()],
  [ALERTS_QA_SAMPLING_COLLECTION, () => getQASamples()],
  [SLA_POLICIES_COLLECTION, () => getSLAPolicies()],
  [ML_MODELS_COLLECTION, () => getMlModels()],
  [UNIQUE_TAGS_COLLECTION, () => allUniqueTags()],
  [RULE_QUEUES_COLLECTION, () => getRandomRuleQueues()],
  [REASONS_COLLECTION, () => getDefaultReasonsData()],
]

export async function seedMongo(client: MongoClient, tenantId: string) {
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

  try {
    logger.info('Get all collections')
    const col = await allCollections(tenantId, db)
    logger.info('Truncating collections')
    await Promise.allSettled(col.map((c) => db.collection(c).deleteMany({})))
  } catch (e) {
    logger.info("Couldn't empty collections")
  }

  await createMongoDBCollections(client, tenantId)
  await createGlobalMongoDBCollections(client)

  logger.info('Setting counters')
  const counterCollection = db.collection<EntityCounter>(
    COUNTER_COLLECTION(tenantId)
  )
  const counters: [CounterEntity, number][] = [
    ['Report', getReports().length],
    ['Case', getCases().length],
    ['Alert', getCases().flatMap((c) => c.alerts).length],
    ['SLAPolicy', getSLAPolicies().length],
    ['RiskFactor', riskFactors().length],
    ['ClosureReason', DEFAULT_CLOSURE_REASONS.length],
    ['EscalationReason', DEFAULT_ESCALATION_REASONS.length],
  ]

  for (const counter of counters) {
    await counterCollection.findOneAndUpdate(
      { entity: counter[0] },
      { $set: { count: counter[1] } },
      { upsert: true, returnDocument: 'after' }
    )
  }

  await db.collection(ML_MODELS_COLLECTION()).deleteMany({})

  logger.info('Creating collections')
  for (const [collectionNameFn, data] of collections) {
    const collection = db.collection(collectionNameFn(tenantId) as string)
    const collectionData = data()
    const clonedData = cloneDeep(collectionData)

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
    mongoDb
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

  if (isClickhouseEnabledInRegion()) {
    const mongoConsumerService = new MongoDbConsumer(client)
    await createTenantDatabase(tenantId)
    await Promise.all(
      ClickHouseTables.map(async (table) => {
        const clickhouseTable = table.table
        // clear everything clickhouse table
        const mongoTable = CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO()[table.table]
        const mongoCollectionName = `${tenantId}-${mongoTable}`
        const data = db.collection(mongoCollectionName).find().batchSize(100)
        let dataArray: WithId<Document>[] = []
        for await (const dataChunk of data) {
          dataArray.push(dataChunk)
          if (dataArray.length === 100) {
            const updatedData = await mongoConsumerService.updateInsertMessages(
              mongoTable,
              dataArray
            )

            await batchInsertToClickhouse(
              tenantId,
              clickhouseTable,
              updatedData
            )
            dataArray = []
          }
        }
        if (dataArray.length > 0) {
          const updatedData = await mongoConsumerService.updateInsertMessages(
            mongoTable,
            dataArray
          )

          await batchInsertToClickhouse(tenantId, clickhouseTable, updatedData)
        }
      })
    )
  }
  logger.info('Refreshing dashboard stats...')
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb: client,
  })

  await dashboardStatsRepository.refreshAllStats()
  logger.info('Dashboard stats refreshed')

  logger.info('Updating alerts SLA statuses')

  const alertsSLAService = new SLAService(tenantId, client, auth0Domain)

  await alertsSLAService.calculateAndUpdateSLAStatusesForAlerts()

  logger.info('Alerts SLA statuses updated')
}
