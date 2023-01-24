import _ from 'lodash'
import { withFeatureHook } from './feature-test-utils'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'
import {
  DuplicateTransactionReturnType,
  RulesEngineService,
} from '@/services/rules-engine'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { UserMonitoringResult } from '@/@types/openapi-public/UserMonitoringResult'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { User } from '@/@types/openapi-public/User'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { CasePriority } from '@/@types/openapi-internal/CasePriority'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export async function createRule(
  testTenantId: string,
  rule: Partial<Rule>,
  ruleInstance?: Partial<RuleInstance>
) {
  const dynamoDb = getDynamoDbClient()
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
    description: DEFAULT_DESCRIPTION,
    parametersSchema: {},
    defaultParameters: {},
    defaultAction: 'FLAG',
    ruleImplementationName: 'first-payment',
    labels: [],
    defaultCaseCreationType: 'USER',
    defaultCasePriority: 'P1',
    defaultNature: 'AML',
    ...rule,
  })
  const createdRuleInstance =
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      type: rule.type,
      ruleId: createdRule.id as string,
      parameters: createdRule.defaultParameters,
      riskLevelParameters: createdRule.defaultRiskLevelParameters,
      action: createdRule.defaultAction,
      riskLevelActions: createdRule.defaultRiskLevelActions,
      status: 'ACTIVE',
      caseCreationType: createdRule.defaultCaseCreationType as CaseType,
      casePriority: createdRule.defaultCasePriority as CasePriority,
      nature: createdRule.defaultNature,
      ...ruleInstance,
    })

  return async () => {
    await ruleRepository.deleteRule(createdRule.id as string)
    await ruleInstanceRepository.deleteRuleInstance(
      createdRuleInstance.id as string
    )
  }
}

export async function updateRule(
  testTenantId: string,
  ruleId: string,
  changes: Partial<Rule>
) {
  const dynamoDb = getDynamoDbClient()
  const ruleRepository = new RuleRepository(testTenantId, {
    dynamoDb,
  })
  const rule = await ruleRepository.getRuleById(ruleId)
  if (!rule) {
    throw new Error(`Rule not found`)
  }
  await ruleRepository.createOrUpdateRule({ ...rule, ...changes })
}

export async function getRule(
  testTenantId: string,
  ruleId: string
): Promise<Rule> {
  const dynamoDb = getDynamoDbClient()
  const ruleRepository = new RuleRepository(testTenantId, {
    dynamoDb,
  })
  const rule = await ruleRepository.getRuleById(ruleId)
  if (!rule) {
    throw new Error(`Rule not found`)
  }
  return rule
}

export async function bulkVerifyTransactions(
  tenantId: string,
  transactions: Transaction[]
): Promise<TransactionMonitoringResult[] | DuplicateTransactionReturnType[]> {
  const dynamoDb = getDynamoDbClient()
  const results = []
  const rulesEngine = new RulesEngineService(tenantId, dynamoDb)
  for (const transaction of transactions) {
    results.push(await rulesEngine.verifyTransaction(transaction))
  }
  return results
}

export async function bulkVerifyUserEvents(
  tenantId: string,
  userEvents: ConsumerUserEvent[]
): Promise<User[]> {
  const dynamoDb = getDynamoDbClient()
  const results = []
  const rulesEngine = new RulesEngineService(tenantId, dynamoDb)
  for (const userEvent of userEvents) {
    results.push(await rulesEngine.verifyConsumerUserEvent(userEvent))
  }
  return results
}

export function getRuleHits(
  results: (TransactionMonitoringResult | UserMonitoringResult)[]
): boolean[] {
  return results.map((result) => {
    if (result.executedRules?.length > 1) {
      throw new Error('The number of the executed rules should be <= 1')
    }
    return result.executedRules[0]?.ruleHit
  })
}

export const SETUP_TEST_RULE_ID = 'test rule id'

export function setUpRulesHooks(
  tenantId: string,
  rules: Array<Partial<Rule> | Partial<RuleInstance>>
) {
  const cleanups: Array<() => void> = [
    async () => {
      return
    },
  ]

  beforeAll(async () => {
    for (const rule of rules) {
      cleanups.push(
        await createRule(
          tenantId,
          {
            id: SETUP_TEST_RULE_ID,
            name: 'test rule name',
            description: DEFAULT_DESCRIPTION,
            defaultParameters: {},
            defaultAction: 'FLAG',
            ruleImplementationName: 'tests/test-success-rule',
            ...rule,
          },
          _.omit(rule, 'id')
        )
      )
    }
  })
  afterAll(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
  })
}

export interface TransactionRuleTestCase<T = object> {
  name: string
  transactions: Transaction[]
  expectedHits: boolean[]
  ruleParams?: T
}

export function createTransactionRuleTestCase(
  testCaseName: string,
  tenantId: string,
  transactions: Transaction[],
  expectedHits: boolean[]
) {
  test(testCaseName, async () => {
    const results = await bulkVerifyTransactions(tenantId, transactions)
    const ruleHits = getRuleHits(results)
    expect(ruleHits).toEqual(expectedHits)
  })
}

const DEFAULT_DESCRIPTION = 'test rule description.'

export function testRuleDescriptionFormatting(
  testName: string,
  tenantId: string,
  transactions: Transaction[],
  rulePatch: Partial<Rule>,
  expectedDescriptions: (string | null)[]
) {
  test(`Description formatting (${testName})`, async () => {
    const initialRule = await getRule(tenantId, SETUP_TEST_RULE_ID)
    await updateRule(tenantId, SETUP_TEST_RULE_ID, rulePatch)

    expect(transactions.length).toEqual(expectedDescriptions.length)
    const results = await bulkVerifyTransactions(tenantId, transactions)
    expect(results.length).toEqual(expectedDescriptions.length)
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i]
      const expectedDescription = expectedDescriptions[i]
      if (result.hitRules.length === 0) {
        if (expectedDescription != null) {
          throw new Error(
            `Rule doesn't hit, so description should be default, but you expect non-default description: ${expectedDescription}`
          )
        }
      }
      result.executedRules.every((rule) => {
        if (!rule.ruleHit) {
          expect(expectedDescription).toEqual(null)
          expect(rule.ruleDescription).toEqual(DEFAULT_DESCRIPTION)
        } else if (expectedDescription === null) {
          throw new Error(
            `Rule hit, so expected description should not be empty, but it's empty because it's expected to not be hit`
          )
        } else {
          expect(rule.ruleDescription).toEqual(expectedDescription)
        }
      })
    }
    await updateRule(tenantId, SETUP_TEST_RULE_ID, initialRule)
  })
}

export interface UserRuleTestCase {
  name: string
  userEvents: ConsumerUserEvent[]
  expectedHits: boolean[]
}

// For making sure a rule works the same w/ or w/o RULES_ENGINE_RULE_BASED_AGGREGATION feature flag
export function ruleAggregationTest(jestCallback: () => void) {
  describe('With Rule Aggregation', () => {
    withFeatureHook(['RULES_ENGINE_RULE_BASED_AGGREGATION'])
    jestCallback()
  })
  describe('Without Rule Aggregation', () => {
    jestCallback()
  })
}
