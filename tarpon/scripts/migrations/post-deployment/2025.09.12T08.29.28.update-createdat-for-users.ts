import { AggregationCursor, AnyBulkWriteOperation, Db } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { isDemoTenant } from '@/utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  API_REQUEST_LOGS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  if (isDemoTenant(tenant.id)) {
    return
  }
  const mongodb = await getMongoDbClient()
  const db = mongodb.db()
  await Promise.all([
    backfillUsers(db, tenant, '/consumer/users'),
    backfillUsers(db, tenant, '/business/users'),
  ])
  await Promise.all([
    backfillUsersBatch(db, tenant, '/batch/consumer/users'),
    backfillUsersBatch(db, tenant, '/batch/business/users'),
  ])
}

async function backfillUsers(db: Db, tenant: Tenant, url: string) {
  const apiRequestsCollection = db.collection(
    API_REQUEST_LOGS_COLLECTION(tenant.id)
  )
  const records = apiRequestsCollection.aggregate<{
    userId: string
    createdAt: number
  }>([
    {
      $match: {
        timestamp: {
          $gte: 1752567600000,
          $lt: Date.now(),
        },
        path: url,
      },
    },
    {
      $project: {
        _id: 0,
        userId: '$payload.userId',
        createdAt: '$timestamp',
      },
    },
  ])

  await processRecords(db, tenant, records)
}

async function backfillUsersBatch(db: Db, tenant: Tenant, url: string) {
  const apiRequestsCollection = db.collection(
    API_REQUEST_LOGS_COLLECTION(tenant.id)
  )
  const records = apiRequestsCollection.aggregate<{
    userId: string
    createdAt: number
  }>([
    {
      $match: {
        timestamp: {
          $gte: 1752567600000,
          $lt: Date.now(),
        },
        path: url,
      },
    },
    {
      $unwind: {
        path: '$payload.data',
      },
    },
    {
      $project: {
        _id: 0,
        userId: '$payload.data.userId',
        createdAt: '$timestamp',
      },
    },
  ])
  await processRecords(db, tenant, records)
}

async function processRecords(
  db: Db,
  tenant: Tenant,
  records: AggregationCursor<{
    userId: string
    createdAt: number
  }>
) {
  const usersCollection = db.collection(USERS_COLLECTION(tenant.id))
  await processCursorInBatch(
    records,
    async (records) => {
      const bulkUpdateRequests: AnyBulkWriteOperation[] = records.map(
        (record) => ({
          updateOne: {
            filter: { userId: record.userId },
            update: { $set: { createdAt: record.createdAt } },
          },
        })
      )
      await usersCollection.bulkWrite(bulkUpdateRequests)
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 1000,
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
