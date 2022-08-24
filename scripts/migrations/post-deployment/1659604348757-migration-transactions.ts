import { TarponStackConstants } from '@cdk/constants'
import { getDynamoDbClient, getMongoDbClient } from '../utils/db'
import { migrateAllTenants } from '../utils/tenant'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { Tenant } from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

async function migrateTenant(tenant: Tenant) {
  console.info(`Starting to migrate tenant ${tenant.name} (ID: ${tenant.id})`)
  const dynamodb = await getDynamoDbClient()
  const mongodb = await getMongoDbClient(
    TarponStackConstants.MONGO_DB_DATABASE_NAME
  )
  const transactionCollection = mongodb
    .db()
    .collection<TransactionCaseManagement>(TRANSACTIONS_COLLECTION(tenant.id))
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
    await dynamodb
      .update({
        TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.TRANSACTION(tenant.id, transaction.transactionId),
        UpdateExpression: `SET hitRules = :hitRules`,
        ExpressionAttributeValues: {
          ':hitRules': hitRules,
        },
      })
      .promise()
    console.info(`Migrated transaction ${transaction.transactionId}`)
    migratedCount += 1
  }
  console.info(`Migrated ${migratedCount} transactions`)
}

migrateAllTenants(migrateTenant)
