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
    [key]: { $gt: thresholdTimestamp },
  })

  for await (const entity of entities) {
    const updatedEntity = {
      ...entity,
      createdAt: entity[key],
    }

    await collection.updateOne(
      { _id: entity._id },
      { $set: updatedEntity },
      { upsert: true }
    )
  }

  console.log(`Migrated ${collectionName} for tenant ${tenant.id}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
