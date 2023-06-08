import { AnyBulkWriteOperation } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import {
  TRANSACTIONS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  USERS_COLLECTION,
  USER_EVENTS_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'

const thresholdTimestamp = new Date('2023-05-31T11:59:59.999Z').getTime()

async function migrateTenant(tenant: Tenant) {
  await migrateEntities(tenant, TRANSACTIONS_COLLECTION, 'timestamp')
  await migrateEntities(tenant, TRANSACTION_EVENTS_COLLECTION, 'timestamp')
  await migrateEntities(tenant, USERS_COLLECTION, 'createdTimestamp')
  await migrateEntities(tenant, USER_EVENTS_COLLECTION, 'timestamp')
}

async function migrateEntities(
  tenant: Tenant,
  getCollectionName: (tenantId: string) => string,
  key: string
) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const collectionName = getCollectionName(tenant.id)
  const collection = db.collection(collectionName)

  const entities = await collection.find({
    $and: [
      {
        createdAt: {
          $exists: false,
        },
      },
      {
        [key]: {
          $gte: thresholdTimestamp,
        },
      },
    ],
  })

  const totalCount = await entities.count()

  console.log(
    `Migrating ${totalCount} documents in ${collectionName} for tenant ${tenant.id} ${tenant.name}`
  )

  const bulkOps: AnyBulkWriteOperation[] = []
  let count = 0
  for await (const entity of entities) {
    const updatedEntity = {
      ...entity,
      createdAt: entity[key],
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: entity._id },
        update: { $set: updatedEntity },
        upsert: true,
      },
    })

    count++

    if (count % 5000 === 0) {
      await collection.bulkWrite(bulkOps)
      bulkOps.length = 0
      console.log(
        `Migrated ${count} documents in ${collectionName} of ${totalCount}`
      )
    }
  }

  if (bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps)
    console.log(
      `Migrated ${count} documents in ${collectionName} of ${totalCount}`
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
