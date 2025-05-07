import { PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { isEmpty, omit } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  for (const instance of ruleInstances) {
    if (instance.riskLevelLogic && isEmpty(instance.riskLevelLogic)) {
      const putItemInput: PutCommandInput = {
        TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
        Item: {
          ...DynamoDbKeys.RULE_INSTANCE(tenant.id, instance.id),
          ...omit(instance, ['riskLevelLogic']),
        },
      }
      await dynamoDb.send(new PutCommand(putItemInput))
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
