import { omit, uniq } from 'lodash'
import { createConsumerUser, getTestUser } from './user-test-utils'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { Rule } from '@/@types/openapi-internal/Rule'
import {
  DuplicateTransactionReturnType,
  RulesEngineService,
} from '@/services/rules-engine'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { User } from '@/@types/openapi-public/User'
import { Priority } from '@/@types/openapi-internal/Priority'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Business } from '@/@types/openapi-public/Business'
import { RuleHitMeta } from '@/@types/openapi-public/RuleHitMeta'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { ConsumerUsersResponse } from '@/@types/openapi-public/ConsumerUsersResponse'
import { BusinessUsersResponse } from '@/@types/openapi-public/BusinessUsersResponse'

const DEFAULT_DESCRIPTION = 'test rule description.'

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
      casePriority: createdRule.defaultCasePriority as Priority,
      nature: createdRule.defaultNature,
      labels: createdRule.labels,
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
  transactions: Transaction[],
  options?: {
    autoCreateUser?: boolean
  }
): Promise<TransactionMonitoringResult[] | DuplicateTransactionReturnType[]> {
  const dynamoDb = getDynamoDbClient()
  let cleanUps: Array<() => Promise<void>> = []
  if (options?.autoCreateUser) {
    const userRepository = new UserRepository(tenantId, { dynamoDb })
    const userIds = uniq(
      transactions
        .flatMap((t) => [t.originUserId, t.destinationUserId])
        .filter(Boolean) as string[]
    )
    cleanUps = await Promise.all(
      userIds.map(async (userId) => {
        const user = await userRepository.getUser(userId)
        if (!user) {
          return await createConsumerUser(tenantId, getTestUser({ userId }))
        }
        return async () => {
          return
        }
      })
    )
  }

  const results: any[] = []
  const rulesEngine = new RulesEngineService(tenantId, dynamoDb)
  for (const transaction of transactions) {
    results.push(await rulesEngine.verifyTransaction(transaction))
  }
  await Promise.all(cleanUps.map((c) => c()))
  ;(dynamoDb as any).__rawClient.destroy()
  return results
}

export async function bulkVerifyUsers(
  tenantId: string,
  users: Array<Business | User>,
  ongoingScreeningMode?: boolean
): Promise<Array<ConsumerUsersResponse | BusinessUsersResponse>> {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const results: any[] = []
  const rulesEngine = new RulesEngineService(tenantId, dynamoDb, mongoDb)
  for (const user of users) {
    results.push(await rulesEngine.verifyUser(user, { ongoingScreeningMode }))
  }
  return results
}

export function getRuleHits(
  results: (
    | TransactionMonitoringResult
    | ConsumerUsersResponse
    | BusinessUsersResponse
  )[]
): boolean[] {
  return results.map((result) => {
    if (result.executedRules && result.executedRules?.length > 1) {
      throw new Error('The number of the executed rules should be <= 1')
    }
    return result.executedRules?.[0]?.ruleHit ?? false
  })
}

export function getRuleHitMetadata(
  results: (
    | TransactionMonitoringResult
    | ConsumerUsersResponse
    | BusinessUsersResponse
  )[]
): RuleHitMeta[] {
  return results.map((result) => {
    if (result.executedRules && result.executedRules?.length > 1) {
      throw new Error('The number of the executed rules should be <= 1')
    }
    return result.executedRules?.[0].ruleHitMeta as RuleHitMeta
  })
}

export function getRuleDescriptions(
  results: (
    | TransactionMonitoringResult
    | ConsumerUsersResponse
    | BusinessUsersResponse
  )[]
): string[] {
  return results.map((result) => {
    if (result.executedRules && result.executedRules?.length > 1) {
      throw new Error('The number of the executed rules should be <= 1')
    }
    return result.executedRules?.[0].ruleDescription || ''
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
      const libraryRule = rule.id ? getRuleByRuleId(rule.id) : undefined
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
            ...libraryRule,
            ...rule,
          },
          omit(rule, 'id')
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
  expectedHits: boolean[],
  expectedRuleDescriptions?: Array<string | undefined>,
  options?: {
    autoCreateUser?: boolean
  }
) {
  test(testCaseName, async () => {
    const results = await bulkVerifyTransactions(tenantId, transactions, {
      autoCreateUser: options?.autoCreateUser ?? true,
    })
    const ruleHits = getRuleHits(results)
    expect(ruleHits).toEqual(expectedHits)
    if (expectedRuleDescriptions) {
      expect(getRuleDescriptions(results)).toEqual(expectedRuleDescriptions)
    }
  })
}

export function createUserRuleTestCase(
  testCaseName: string,
  tenantId: string,
  users: Array<Business | User>,
  expectetRuleHitMetadata: Array<RuleHitMeta | undefined>,
  expectedRuleDescriptions?: Array<string | undefined>,
  ongoingScreeningMode?: boolean
) {
  test(testCaseName, async () => {
    const results = await bulkVerifyUsers(tenantId, users, ongoingScreeningMode)
    expect(getRuleHitMetadata(results)).toEqual(expectetRuleHitMetadata)
    if (expectedRuleDescriptions) {
      expect(getRuleDescriptions(results)).toEqual(expectedRuleDescriptions)
    }
  })
}

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

    const results = await bulkVerifyTransactions(tenantId, transactions, {
      autoCreateUser: true,
    })
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
  users: Array<Business | User>
  expectetRuleHitMetadata: Array<RuleHitMeta | undefined>
  expectedRuleDescriptions?: Array<string | undefined>
}

// For making sure a rule works the same w/ or w/o RULES_ENGINE_RULE_BASED_AGGREGATION feature flag
export function ruleVariantsTest(
  ruleAggregationImplemented: boolean,
  jestCallback: () => void
) {
  if (ruleAggregationImplemented) {
    describe('database:dynamodb; rule-aggregation:on', () => {
      jestCallback()
    })
  }
  describe('database:dynamodb; rule-aggregation:off', () => {
    beforeAll(() => {
      process.env.__INTERNAL_DISABLE_RULE_AGGREGATION__ = 'true'
    })
    afterAll(() => {
      process.env.__INTERNAL_DISABLE_RULE_AGGREGATION__ = ''
    })
    jestCallback()
  })
  describe('database:mongodb; rule-aggregation:off', () => {
    beforeAll(() => {
      process.env.__INTERNAL_DISABLE_RULE_AGGREGATION__ = 'true'
      process.env.__INTERNAL_MONGODB_MIRROR__ = 'true'
    })
    afterAll(() => {
      process.env.__INTERNAL_DISABLE_RULE_AGGREGATION__ = ''
      process.env.__INTERNAL_MONGODB_MIRROR__ = ''
    })
    jestCallback()
  })
}
