import { exit } from 'process'
import { TarponStackConstants } from '@cdk/constants'
import { getDynamoDbClient, getMongoDbClient } from './utils/db'
import { getConfig } from './utils/config'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { AccountsConfig } from '@/lambdas/phytoplankton-internal-api-handlers/app'
import {
  AccountsService,
  Tenant,
} from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

const config = getConfig()

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

async function main() {
  const accountsService = new AccountsService(
    config.application as AccountsConfig
  )
  const tenants = await accountsService.getTenants()

  for (const tenant of tenants) {
    await migrateTenant(tenant)
  }
}

main()
  .then(() => {
    console.info('Migration completed.')
    exit(0)
  })
  .catch((e) => {
    console.error(e)
    exit(1)
  })
