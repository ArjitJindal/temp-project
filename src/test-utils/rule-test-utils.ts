import _ from 'lodash'
import { getTestDynamoDb } from './dynamodb-test-utils'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'

export async function createRule(testTenantId: string, rule: Partial<Rule>) {
  const dynamoDb = getTestDynamoDb()
  const ruleRepository = new RuleRepository(testTenantId, {
    dynamoDb,
  })
  const ruleInstanceRepository = new RuleInstanceRepository(testTenantId, {
    dynamoDb,
  })
  const createdRule = await ruleRepository.createOrUpdateRule({
    name: 'test rule name',
    description: 'test rule description',
    parametersSchema: {},
    defaultParameters: {},
    defaultAction: 'FLAG',
    ruleImplementationFilename: 'first-payment',
    ..._.omitBy(rule, _.isNil),
  })
  const createdRuleInstance =
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      ruleId: createdRule.id as string,
      parameters: createdRule.defaultParameters,
      action: createdRule.defaultAction,
      status: 'ACTIVE',
    })

  return async () => {
    await ruleRepository.deleteRule(createdRule.id as string)
    await ruleInstanceRepository.deleteRuleInstance(
      createdRuleInstance.id as string
    )
  }
}
