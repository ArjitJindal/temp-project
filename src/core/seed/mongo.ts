import { MongoClient } from 'mongodb'
import {
  allCollections,
  ARS_SCORES_COLLECTION,
  CASES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { transactions } from '@/core/seed/data/transactions'
import { init as caseInit, data as cases } from '@/core/seed/data/cases'
import { init as userInit, data as users } from '@/core/seed/data/users'
import { init as krsInit, data as krs } from '@/core/seed/data/krs_scores'
import { init as arsInit, data as ars } from '@/core/seed/data/ars_scores'
import { init as drsInit, data as drs } from '@/core/seed/data/drs_scores'
import {
  init as transactionEventsInit,
  data as transactionEvents,
} from '@/core/seed/data/transaction_events'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { Account, AccountsService } from '@/services/accounts'
import { Case } from '@/@types/openapi-internal/Case'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { getRandomIntInclusive } from '@/scripts/utils'

const collections: [(tenantId: string) => string, Iterable<unknown>][] = [
  [TRANSACTIONS_COLLECTION, transactions],
  [CASES_COLLECTION, cases],
  [USERS_COLLECTION, users],
  [KRS_SCORES_COLLECTION, krs],
  [ARS_SCORES_COLLECTION, ars],
  [DRS_SCORES_COLLECTION, drs],
  [TRANSACTION_EVENTS_COLLECTION, transactionEvents],
]

export async function seedMongo(client: MongoClient, tenantId: string) {
  const db = await client.db()
  const col = await allCollections(tenantId, db)
  await Promise.all(col.map((c) => db.collection(c).drop()))

  // TODO there will be a neater way of achieving this.
  caseInit()
  userInit()
  krsInit()
  arsInit()
  drsInit()
  transactionEventsInit()

  for (const [collectionNameFn, data] of collections) {
    console.log(`Re-create collection: ${collectionNameFn(tenantId)}`)
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

  const tenant = await accountsService.getTenantById(tenantId)
  const accounts =
    tenant != null ? await accountsService.getTenantAccounts(tenant) : []

  const cases = db.collection<Case>(CASES_COLLECTION(tenantId))
  const casesToUpdate = await cases.find().toArray()

  await Promise.all(
    casesToUpdate.map(async (c) => {
      return await cases.replaceOne(
        { _id: c._id },
        {
          ...c,
          assignments: accounts?.length
            ? [getRandomAssigneeObject(accounts)]
            : undefined,
          reviewAssignments: accounts?.length
            ? [getRandomAssigneeObject(accounts)]
            : undefined,
          alerts:
            c.alerts?.map((a) => ({
              ...a,
              assignments: accounts?.length
                ? [getRandomAssigneeObject(accounts)]
                : undefined,
              reviewAssignments: accounts?.length
                ? [getRandomAssigneeObject(accounts)]
                : undefined,
            })) ?? [],
        }
      )
    })
  )

  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb: client,
  })

  await dashboardStatsRepository.refreshAllStats()
  await client.close()
}

const getRandomAssigneeObject = (accounts: Account[]): Assignment => {
  const randomAccountIndex = getRandomIntInclusive(0, accounts.length - 1)

  return {
    assigneeUserId: accounts[randomAccountIndex].id,
    timestamp: Date.now(),
  }
}
