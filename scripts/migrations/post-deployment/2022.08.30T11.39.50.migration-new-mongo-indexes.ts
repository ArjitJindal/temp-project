import { MigrationFn } from 'umzug'
import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import {
  getMongoDbClient,
  TRANSACTIONS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  console.log(`Migrate ${tenant.name} (#${tenant.id})`)
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const transactionCollection = mongodb
    .db()
    .collection(TRANSACTIONS_COLLECTION(tenant.id))

  try {
    await transactionCollection.dropIndex('timestamp_1_type_1_status_1')
  } catch (e) {
    console.log(`FAILED TO delete transaction indexes`)
  }
  const usersCollection = mongodb.db().collection(USERS_COLLECTION(tenant.id))

  try {
    await usersCollection.dropIndex('createdTimestamp_1')
  } catch (e) {
    console.log(`FAILED TO delete user indexes`)
  }
  const transactionEventsCollection = mongodb
    .db()
    .collection(TRANSACTION_EVENTS_COLLECTION(tenant.id))

  try {
    await transactionEventsCollection.dropIndex(
      'transactionId_1_timestamp_1_transactionState_1'
    )
  } catch (e) {
    console.log(`FAILED TO delete transaction event indexes`)
  }
}

export const up: MigrationFn = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down: MigrationFn = async () => {
  // skip
}
