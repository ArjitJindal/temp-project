import { MongoClient } from 'mongodb'
import {
  allCollections,
  ARS_SCORES_COLLECTION,
  CASES_COLLECTION,
  createMongoDBCollections,
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
} from '@/utils/mongoDBUtils'
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
import { Account, AccountsService } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { getRandomIntInclusive } from '@/scripts/utils'
import { logger } from '@/core/logger'
import { pickRandom } from '@/utils/prng'
import dayjs from '@/utils/dayjs'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'

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
  [CRM_ENGAGEMENTS_COLLECTION, engagements],
  [CRM_TASKS_COLLECTION, tasks],
  [CRM_NOTES_COLLECTION, notes],
  [CRM_SUMMARY_COLLECTION, summaries],
]

export async function seedMongo(client: MongoClient, tenantId: string) {
  const db = await client.db()

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
  txnInit()
  caseInit()
  auditLogInit()
  arsInit()
  transactionEventsInit()
  sanctionsInit()
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

  // Apply some random assignments from auth0 users
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

  const accounts =
    tenant != null ? await accountsService.getTenantAccounts(tenant) : []

  logger.info(`Accounts: ${JSON.stringify(accounts)}`)

  const cases = db.collection<Case>(CASES_COLLECTION(tenantId))
  const casesToUpdate = await cases.find().toArray()

  await Promise.all(
    casesToUpdate.map(async (c) => {
      const caseAssignments = getRandomAssigneeObject(accounts)

      return await cases.replaceOne(
        { _id: c._id },
        {
          ...c,
          statusChanges: getStatusChangesObject(
            c.caseStatus ?? 'OPEN',
            caseAssignments.assigneeUserId
          ),
          assignments: accounts?.length ? [caseAssignments] : undefined,
          reviewAssignments: accounts?.length
            ? [getRandomAssigneeObject(accounts)]
            : undefined,
          alerts: c.alerts?.map((a) => {
            const alertsAssignments = getRandomAssigneeObject(accounts)
            return {
              ...a,
              statusChanges: getStatusChangesObject(
                a.alertStatus ?? 'OPEN',
                alertsAssignments.assigneeUserId,
                true
              ),
              assignments: accounts?.length ? [alertsAssignments] : undefined,
              reviewAssignments: accounts?.length
                ? [getRandomAssigneeObject(accounts)]
                : undefined,
            }
          }),
        }
      )
    })
  )

  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb: client,
  })

  await dashboardStatsRepository.refreshAllStats()
}

const getStatusChangesObject = (
  caseStatus: CaseStatus,
  userId: string,
  alerts?: boolean
): CaseStatusChange[] => {
  const statusChanges: CaseStatusChange[] = []
  if (caseStatus !== 'OPEN') {
    let insterted = false
    if (
      pickRandom([true, false]) &&
      caseStatus !== 'OPEN_IN_PROGRESS' &&
      caseStatus.includes('OPEN')
    ) {
      statusChanges.push({
        caseStatus: 'OPEN_IN_PROGRESS',
        timestamp: dayjs()
          .subtract(Math.floor(Math.random() * (alerts ? 150 : 400)), 'minute')
          .valueOf(),
        userId,
      })
      insterted = true
    }
    if (!insterted || caseStatus !== 'OPEN_IN_PROGRESS') {
      statusChanges.push({
        caseStatus: caseStatus,
        timestamp: dayjs().valueOf(),
        userId,
      })
    }
  }
  return statusChanges
}

const getRandomAssigneeObject = (accounts: Account[]): Assignment => {
  const randomAccountIndex = getRandomIntInclusive(0, accounts.length - 1)
  logger.info(
    `Assigning to ${accounts[randomAccountIndex]?.id}, JSON: ${JSON.stringify(
      accounts[randomAccountIndex]
    )}`
  )
  return {
    assigneeUserId: accounts[randomAccountIndex]?.id,
    timestamp: Date.now(),
  }
}
