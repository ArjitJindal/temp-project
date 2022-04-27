import _ from 'lodash'
import { getTestDynamoDbClient } from './dynamodb-test-utils'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'
import { verifyTransaction, verifyUserEvent } from '@/services/rules-engine'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { UserMonitoringResult } from '@/@types/openapi-public/UserMonitoringResult'
import { UserEvent } from '@/@types/openapi-public/UserEvent'

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
    type: 'TRANSACTION',
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
      type: rule.type,
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

export async function bulkVerifyUserEvents(
  tenantId: string,
  userEvents: UserEvent[]
): Promise<UserMonitoringResult[]> {
  const dynamoDb = getTestDynamoDbClient()
  const results = []
  for (const userEvent of userEvents) {
    results.push(await verifyUserEvent(userEvent, tenantId, dynamoDb))
  }
  return results
}

export function getRuleActions(
  results: (TransactionMonitoringResult | UserMonitoringResult)[]
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
          id: 'test rule id',
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
export interface TransactionRuleTestCase {
  name: string
  transactions: Transaction[]
  expectedActions: RuleAction[]
}

export function createTransactionRuleTestCase(
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

export interface UserRuleTestCase {
  name: string
  userEvents: UserEvent[]
  expectedActions: RuleAction[]
}

export function createUserRuleTestCase(
  testCaseName: string,
  tenantId: string,
  userEvents: UserEvent[],
  expectedRuleActions: RuleAction[]
) {
  test(testCaseName, async () => {
    const results = await bulkVerifyUserEvents(tenantId, userEvents)
    const ruleActions = getRuleActions(results)
    expect(ruleActions).toEqual(expectedRuleActions)
  })
}
