import { MongoClient } from 'mongodb'
import { chunk, cloneDeep } from 'lodash'
import { logger } from '../logger'
import { data as krsAndDrsScoreData } from './data/risk-scores'
import { getCases } from './data/cases'
import { getNotifications } from './data/notifications'
import { allCollections, createMongoDBCollections } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  MERCHANT_MONITORING_DATA_COLLECTION,
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
} from '@/utils/mongodb-definitions'
import { getTransactions } from '@/core/seed/data/transactions'
import { getUsers, getMerchantMonitoring } from '@/core/seed/data/users'
import { auditlogs } from '@/core/seed/data/auditlogs'
import { getSanctions } from '@/core/seed/data/sanctions'
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
import { AccountsService } from '@/services/accounts'
import { setAccounts } from '@/core/seed/samplers/accounts'
import { getChecklistTemplates } from '@/core/seed/data/checklists'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { CounterEntity, EntityCounter } from '@/services/counter/repository'
import { ShadowRuleStatsAnalytics } from '@/services/analytics/rules/shadow-rule-stats'

const collections: [(tenantId: string) => string, () => unknown[]][] = [
  [TRANSACTIONS_COLLECTION, () => getTransactions()],
  [CASES_COLLECTION, () => getCases()],
  [USERS_COLLECTION, () => getUsers()],
  [KRS_SCORES_COLLECTION, () => krsAndDrsScoreData()[0]],
  [AUDITLOG_COLLECTION, () => auditlogs()],
  [DRS_SCORES_COLLECTION, () => krsAndDrsScoreData()[1]],
  [TRANSACTION_EVENTS_COLLECTION, () => transactionEvents()],
  [MERCHANT_MONITORING_DATA_COLLECTION, () => getMerchantMonitoring()],
  [SANCTIONS_SEARCHES_COLLECTION, () => getSanctions()],
  [REPORT_COLLECTION, () => getReports()],
  [CRM_ENGAGEMENTS_COLLECTION, () => getEngagements()],
  [CRM_TASKS_COLLECTION, () => getTasks()],
  [CRM_NOTES_COLLECTION, () => getNotes()],
  [CRM_SUMMARY_COLLECTION, () => getSummaries()],
  [SIMULATION_TASK_COLLECTION, () => getSimulations()],
  [CHECKLIST_TEMPLATE_COLLECTION, () => getChecklistTemplates()],
  [NOTIFICATIONS_COLLECTION, () => getNotifications()],
]

export async function seedMongo(client: MongoClient, tenantId: string) {
  const db = client.db()
  const originalTenantId = tenantId.replace('-test', '')
  const tenantRepository = new TenantRepository(originalTenantId, {
    mongoDb: client,
    dynamoDb: getDynamoDbClient(),
  })
  const settings = await tenantRepository.getTenantSettings(['auth0Domain'])
  const auth0Domain =
    settings.auth0Domain || (process.env.AUTH0_DOMAIN as string)
  const accountsService = new AccountsService(
    { auth0Domain },
    { mongoDb: client }
  )
  logger.info(`TenantId: ${tenantId}`)

  let tenant = await accountsService.getTenantById(originalTenantId) // As we are appending -test to the tenantId, we need to remove it to get the real tenantId when in demo mode

  logger.info(`Tenant: ${JSON.stringify(tenant)}`)

  if (tenant == null) {
    tenant = await accountsService.getTenantById(tenantId)
  }

  const allAccounts =
    tenant != null ? await accountsService.getTenantAccounts(tenant) : []
  const accounts = allAccounts.filter(
    (account) =>
      account.role !== 'root' &&
      !account.blocked &&
      account.name.endsWith('flagright.com')
  )

  logger.info(`Accounts: ${JSON.stringify(accounts)}`)

  setAccounts(accounts)

  try {
    logger.info('Get all collections')
    const col = await allCollections(tenantId, db)
    logger.info('Truncating collections')
    await Promise.allSettled(col.map((c) => db.collection(c).deleteMany({})))
  } catch (e) {
    logger.info("Couldn't empty collections")
  }

  await createMongoDBCollections(client, tenantId)

  logger.info('Setting counters')
  const counterCollection = db.collection<EntityCounter>(
    COUNTER_COLLECTION(tenantId)
  )
  const counters: [CounterEntity, number][] = [
    ['Report', getReports().length],
    ['Case', getCases().length],
    ['Alert', getCases().flatMap((c) => c.alerts).length],
  ]

  for (const counter of counters) {
    await counterCollection.findOneAndUpdate(
      { entity: counter[0] },
      { $set: { count: counter[1] } },
      { upsert: true, returnDocument: 'after' }
    )
  }

  logger.info('Creating collections')
  for (const [collectionNameFn, data] of collections) {
    logger.info(`Re-create collection: ${collectionNameFn(tenantId)}`)
    const collection = db.collection(collectionNameFn(tenantId) as string)
    const collectionData = data()
    const clonedData = cloneDeep(collectionData)

    for await (const dataChunk of chunk(clonedData, 10000)) {
      await collection.insertMany(dataChunk as any[])
    }
  }

  logger.info('Refreshing dashboard stats...')
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb: client,
  })

  await dashboardStatsRepository.refreshAllStats()
  await ShadowRuleStatsAnalytics.refresh(tenantId)
  logger.info('Dashboard stats refreshed')
}
