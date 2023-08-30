import { MongoClient } from 'mongodb'
import { logger } from '../logger'
import { allCollections, createMongoDBCollections } from '@/utils/mongodb-utils'
import {
  ARS_SCORES_COLLECTION,
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
} from '@/utils/mongodb-definitions'
import { init as txnInit, transactions } from '@/core/seed/data/transactions'
import { init as caseInit, data as cases } from '@/core/seed/data/cases'
import {
  init as userInit,
  data as users,
  drsData as drs,
  krsData as krs,
  merchantMonitoring,
} from '@/core/seed/data/users'
import { init as auditLogInit, auditlogs } from '@/core/seed/data/auditlogs'
import { init as arsInit, data as ars } from '@/core/seed/data/ars_scores'
import {
  init as sanctionsInit,
  data as sanctions,
} from '@/core/seed/data/sanctions'
import { init as reportsInit, data as reports } from '@/core/seed/data/reports'
import {
  init as simulationInit,
  data as simulation,
} from '@/core/seed/data/simulation'
import {
  init as crmInit,
  notes,
  engagements,
  tasks,
  summaries,
} from '@/core/seed/data/crm'
import {
  init as transactionEventsInit,
  data as transactionEvents,
} from '@/core/seed/data/transaction_events'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { AccountsService } from '@/services/accounts'
import { setAccounts } from '@/core/seed/samplers/accounts'
import {
  checklistTemplates,
  initChecklistTemplate,
} from '@/core/seed/data/checklists'
import { initRules } from '@/core/seed/data/rules'

const collections: [(tenantId: string) => string, Iterable<unknown>][] = [
  [TRANSACTIONS_COLLECTION, transactions],
  [CASES_COLLECTION, cases],
  [USERS_COLLECTION, users],
  [KRS_SCORES_COLLECTION, krs],
  [AUDITLOG_COLLECTION, auditlogs],
  [ARS_SCORES_COLLECTION, ars],
  [DRS_SCORES_COLLECTION, drs],
  [TRANSACTION_EVENTS_COLLECTION, transactionEvents],
  [MERCHANT_MONITORING_DATA_COLLECTION, merchantMonitoring],
  [SANCTIONS_SEARCHES_COLLECTION, sanctions],
  [REPORT_COLLECTION, reports],
  [CRM_ENGAGEMENTS_COLLECTION, engagements],
  [CRM_TASKS_COLLECTION, tasks],
  [CRM_NOTES_COLLECTION, notes],
  [CRM_SUMMARY_COLLECTION, summaries],
  [SIMULATION_TASK_COLLECTION, simulation],
  [CHECKLIST_TEMPLATE_COLLECTION, checklistTemplates],
]

export async function seedMongo(client: MongoClient, tenantId: string) {
  const db = await client.db()

  const accountsService = new AccountsService(
    { auth0Domain: process.env.AUTH0_DOMAIN as string },
    { mongoDb: client }
  )
  logger.info(`TenantId: ${tenantId}`)

  let tenant = await accountsService.getTenantById(
    tenantId.replace('-test', '')
  ) // As we are appending -test to the tenantId, we need to remove it to get the real tenantId when in demo mode

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

  logger.info('Init seed data')
  // TODO there will be a neater way of achieving this.
  userInit()
  initChecklistTemplate()
  initRules()
  txnInit()
  caseInit()
  auditLogInit()
  arsInit()
  transactionEventsInit()
  sanctionsInit()
  reportsInit()
  simulationInit()
  crmInit()

  logger.info('Creating collections')
  for (const [collectionNameFn, data] of collections) {
    logger.info(`Re-create collection: ${collectionNameFn(tenantId)}`)
    const collection = db.collection(collectionNameFn(tenantId) as string)
    try {
      await collection.drop()
    } catch (e) {
      // ignore
    }
    const iterator = data[Symbol.iterator]()
    let batch = []
    let i = 0
    let result
    do {
      result = iterator.next()
      if (!result.done) {
        batch.push(result.value)
      }
      i++
      if (result.done || batch.length === 10000) {
        console.log(`Finished ${i} items`)

        if (batch.length > 0) {
          await collection.insertMany(batch as any)
        }
        batch = []
      }
    } while (!result.done)
  }

  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb: client,
  })

  await dashboardStatsRepository.refreshAllStats()
}
