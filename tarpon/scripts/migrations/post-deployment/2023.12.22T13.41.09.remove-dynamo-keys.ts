import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import {
  ARS_SCORES_COLLECTION,
  DEVICE_DATA_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  USERS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const collectionsNames = [
    USERS_COLLECTION,
    TRANSACTIONS_COLLECTION,
    KRS_SCORES_COLLECTION,
    DRS_SCORES_COLLECTION,
    ARS_SCORES_COLLECTION,
    USER_EVENTS_COLLECTION,
    TRANSACTION_EVENTS_COLLECTION,
    DEVICE_DATA_COLLECTION,
  ]

  for (const collectionName of collectionsNames) {
    const collection = db.collection(collectionName(tenant.id))
    await collection.updateMany(
      {},
      {
        $unset: {
          PartitionKeyID: '',
          SortKeyID: '',
          'krsScore.PartitionKeyID': '',
          'krsScore.SortKeyID': '',
          'drsScore.PartitionKeyID': '',
          'drsScore.SortKeyID': '',
          'arsScore.PartitionKeyID': '',
          'arsScore.SortKeyID': '',
        },
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
