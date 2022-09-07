import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '../utils/db'
import { getRulesById } from '../utils/rule'
import { Tenant } from '@/lambdas/phytoplankton-internal-api-handlers/services/accounts-service'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQueryGenerator } from '@/utils/dynamodb'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'

const RULES_MAPPING: { [key: string]: string } = {
  'R-60': 'R-69',
  'R-84': 'R-30',
  'R-95': 'R-30',
  'R-96': 'R-30',
  'R-103': 'R-30',
  'R-109': 'R-69',
  'R-110': 'R-69',
  'R-112': 'R-2',
}

async function migrateTransactions(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': DynamoDbKeys.TRANSACTION(tenant.id).PartitionKeyID,
    },
    ReturnConsumedCapacity: 'TOTAL',
  }
  for await (const transactionsResult of paginateQueryGenerator(
    dynamoDb,
    queryInput
  )) {
    for (const transaction of (transactionsResult.Items ||
      []) as TransactionWithRulesResult[]) {
      let shouldSave = false
      transaction.executedRules = transaction.executedRules?.map((rule) => {
        const newRuleId = RULES_MAPPING[rule.ruleId]
        if (newRuleId) {
          shouldSave = true
        }
        return newRuleId ? { ...rule, ruleId: newRuleId } : rule
      })
      transaction.hitRules = transaction.hitRules?.map((rule) => {
        const newRuleId = RULES_MAPPING[rule.ruleId]
        if (newRuleId) {
          shouldSave = true
        }
        return newRuleId ? { ...rule, ruleId: newRuleId } : rule
      })
      if (shouldSave && transaction.transactionId) {
        console.info(`Updated transaction ${transaction.transactionId}`)
        const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
          Item: {
            ...DynamoDbKeys.TRANSACTION(tenant.id, transaction.transactionId),
            ...transaction,
          },
          ReturnConsumedCapacity: 'TOTAL',
        }
        await dynamoDb.put(putItemInput).promise()
      }
    }
  }
}

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = await getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()

  for (const ruleInstance of ruleInstances) {
    const newRuleId = RULES_MAPPING[ruleInstance.ruleId]
    if (newRuleId) {
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...ruleInstance,
        ruleId: newRuleId,
      })
      console.info(
        `Updated rule instance ${ruleInstance.ruleId} (${ruleInstance.id})`
      )
    }
  }

  await migrateTransactions(tenant)
}

async function deleteUnusedRules() {
  const dynamoDb = await getDynamoDbClient()
  const rulesById = await getRulesById()
  const ruleRepository = new RuleRepository(FLAGRIGHT_TENANT_ID, {
    dynamoDb,
  })

  for (const ruleId of Object.keys(RULES_MAPPING)) {
    if (rulesById[ruleId]) {
      await ruleRepository.deleteRule(ruleId)
      console.info(`Deleted rule ${ruleId}`)
    }
  }
}

migrateAllTenants(migrateTenant).then(deleteUnusedRules)
