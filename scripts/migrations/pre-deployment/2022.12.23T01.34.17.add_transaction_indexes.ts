import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'

async function migrateTenant(tenant: Tenant) {
  console.log(`Migrate ${tenant.name} (#${tenant.id})`)
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const aggregationCollection = mongodb
    .db()
    .collection(TRANSACTIONS_COLLECTION(tenant.id))
  await aggregationCollection.createIndex('originPaymentDetails.IBAN')
  await aggregationCollection.createIndex(
    'originPaymentDetails.cardFingerprint'
  )
  await aggregationCollection.createIndex('originPaymentDetails.accountNumber')
  await aggregationCollection.createIndex('originPaymentDetails.accountNumber')
  await aggregationCollection.createIndex('originPaymentDetails.accountNumber')
  await aggregationCollection.createIndex('originPaymentDetails.BIC')
  await aggregationCollection.createIndex('originPaymentDetails.swiftCode')
  await aggregationCollection.createIndex('originPaymentDetails.upiID')
  await aggregationCollection.createIndex('deviceData.ipAddress')
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
