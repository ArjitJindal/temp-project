import { MigrationFn } from 'umzug'
import { StackConstants } from '@lib/constants'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { AccountsService, Tenant } from '@/services/accounts'

async function migrateTenant(tenant: Tenant | null) {
  if (!tenant) {
    console.info(`Tenant not found`)
    return
  }
  console.info(`Starting to migrate tenant ${tenant.name} (ID: ${tenant.id})`)
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const transactionCollection = mongodb
    .db()
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
  let migratedCount = 0
  for await (const transaction of transactionCollection.find({
    'hitRules.1': { $exists: 1 },
  })) {
    await dynamodb.send(
      new UpdateCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.TRANSACTION(tenant.id, transaction.transactionId),
        UpdateExpression: `SET hitRules = :hitRules`,
        ExpressionAttributeValues: {
          ':hitRules': [],
        },
      })
    )
    console.info(`Migrated transaction ${transaction.transactionId}`)
    migratedCount += 1
  }
  console.info(`Migrated ${migratedCount} transactions`)
}

export const up: MigrationFn = async () => {
  if (!process.env.ENV?.startsWith('prod')) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const accountsService = new AccountsService(
    { auth0Domain: 'flagright.eu.auth0.com' },
    { mongoDb }
  )
  const kevinTenant = await accountsService.getTenantById('QEO03JYKBT')
  await migrateTenant(kevinTenant)
}

export const down: MigrationFn = async () => {
  // skip
}
