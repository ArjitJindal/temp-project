import {
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/services/accounts/repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getAggVarHash } from '@/services/logic-evaluator/engine/aggregation-repository'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'pnb') {
    return
  }
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const version = Date.now()
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const ruleInstance of ruleInstances) {
    const aggVars = ruleInstance.logicAggregationVariables
    if (!aggVars || aggVars.length === 0 || !ruleInstance.id) {
      continue
    }

    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE_INSTANCE(tenant.id, ruleInstance.id),
        ...{
          ...ruleInstance,
          logicAggregationVariables: aggVars.map((aggVar) => ({
            ...aggVar,
            version: version,
          })),
        },
      },
    }
    await dynamoDb.send(new PutCommand(putItemInput))
    for (const aggVar of aggVars) {
      const updateItemInput: UpdateCommandInput = {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
        Key: DynamoDbKeys.AGGREGATION_VARIABLE(
          tenant.id,
          getAggVarHash(aggVar, false)
        ),
        UpdateExpression: 'set version = :version',
        ExpressionAttributeValues: {
          ':version': version,
        },
      }
      await dynamoDb.send(new UpdateCommand(updateItemInput))
      console.log(`Updated aggregation variable ${aggVar.key}`)
    }
    console.log(`Updated rule instance ${ruleInstance.id}`)
  }
  console.log(`Updated ${ruleInstances.length} rule instances`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
