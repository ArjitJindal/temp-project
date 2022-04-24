import _ from 'lodash'
import { getTestDynamoDbClient } from './dynamodb-test-utils'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'
import { verifyTransaction } from '@/services/rules-engine'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { RuleAction } from '@/@types/openapi-public/RuleAction'

export async function createRule(testTenantId: string, rule: Partial<Rule>) {
  const dynamoDb = getTestDynamoDbClient()
  const ruleRepository = new RuleRepository(testTenantId, {
    dynamoDb,
  })
  const ruleInstanceRepository = new RuleInstanceRepository(testTenantId, {
    dynamoDb,
  })
  const createdRule = await ruleRepository.createOrUpdateRule({
    id: 'rule id',
    name: 'test rule name',
    description: 'test rule description',
    defaultParameters: {},
    defaultAction: 'FLAG',
    ruleImplementationName: 'first-payment',
    labels: [],
    ...rule,
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

export async function bulkVerifyTransactions(
  tenantId: string,
  transactions: Transaction[]
): Promise<TransactionMonitoringResult[]> {
  const dynamoDb = getTestDynamoDbClient()
  const results = []
  for (const transaction of transactions) {
    results.push(await verifyTransaction(transaction, tenantId, dynamoDb))
  }
  return results
}

export function getRuleActions(
  results: TransactionMonitoringResult[]
): RuleAction[] {
  return results.map((result) => {
    if (result.executedRules?.length !== 1) {
      throw new Error('The number of the executed rules is not 1')
    }
    return result.executedRules[0].ruleAction
  })
}

export function setUpRulesHooks(tenantId: string, rules: Array<Partial<Rule>>) {
  const cleanups: Array<() => void> = [
    async () => {
      return
    },
  ]

  beforeAll(async () => {
    for (const rule of rules) {
      cleanups.push(
        await createRule(tenantId, {
          id: 'rule id',
          name: 'test rule name',
          description: 'test rule description',
          defaultParameters: {},
          defaultAction: 'FLAG',
          ruleImplementationName: 'tests/test-success-rule',
          ...rule,
        })
      )
    }
  })
  afterAll(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
  })
}
export interface RuleTestCase {
  name: string
  transactions: Transaction[]
  expectedActions: RuleAction[]
}

export function createRuleTestCase(
  testCaseName: string,
  tenantId: string,
  transactions: Transaction[],
  expectedRuleActions: RuleAction[]
) {
  test(testCaseName, async () => {
    const results = await bulkVerifyTransactions(tenantId, transactions)
    const ruleActions = getRuleActions(results)
    expect(ruleActions).toEqual(expectedRuleActions)
  })
}
