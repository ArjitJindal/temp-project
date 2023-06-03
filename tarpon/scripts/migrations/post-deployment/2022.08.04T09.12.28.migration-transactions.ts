import { MigrationFn } from 'umzug'
import { StackConstants } from '@lib/constants'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient, TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  console.info(`Starting to migrate tenant ${tenant.name} (ID: ${tenant.id})`)
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const transactionCollection = mongodb
    .db()
    .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenant.id))
  let migratedCount = 0
  for await (const transaction of transactionCollection.find({
    hitRules: null,
  })) {
    const hitRules = transaction.executedRules
      .filter((rule) => rule.ruleHit)
      .map((rule) => ({
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        ruleDescription: rule.ruleDescription,
        ruleAction: rule.ruleAction,
      }))
    await dynamodb.send(
      new UpdateCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.TRANSACTION(tenant.id, transaction.transactionId),
        UpdateExpression: `SET hitRules = :hitRules`,
        ExpressionAttributeValues: {
          ':hitRules': hitRules,
        },
      })
    )
    console.info(`Migrated transaction ${transaction.transactionId}`)
    migratedCount += 1
  }
  console.info(`Migrated ${migratedCount} transactions`)
}

export const up: MigrationFn = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down: MigrationFn = async () => {
  // skip
}
