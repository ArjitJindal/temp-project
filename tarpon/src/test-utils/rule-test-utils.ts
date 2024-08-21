import { last, omit, zipObject } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import {
  createUserIfNotExists,
  createUsersForTransactions,
} from './user-test-utils'
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
import { User } from '@/@types/openapi-public/User'
import { Priority } from '@/@types/openapi-internal/Priority'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Business } from '@/@types/openapi-public/Business'
import { RuleHitMeta } from '@/@types/openapi-public/RuleHitMeta'
import {
  getRuleByImplementation,
  getRuleByRuleId,
} from '@/services/rules-engine/transaction-rules/library'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ConsumerUserMonitoringResult } from '@/@types/openapi-public/ConsumerUserMonitoringResult'
import { BusinessUserMonitoringResult } from '@/@types/openapi-public/BusinessUserMonitoringResult'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import {
  TRANSACTION_RULES,
  TransactionRuleBase,
} from '@/services/rules-engine/transaction-rules'
import { TransactionAggregationRule } from '@/services/rules-engine/transaction-rules/aggregation-rule'
import { hasFeature } from '@/core/utils/context'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { getMigratedV8Config } from '@/services/rules-engine/v8-migrations'
import { SanctionsService } from '@/services/sanctions'
import { IBANService } from '@/services/iban'
import { GeoIPService } from '@/services/geo-ip'

const DEFAULT_DESCRIPTION = ''

export async function createRule(
  testTenantId: string,
  rule: Partial<Rule>,
  ruleInstance?: Partial<RuleInstance & { ruleInstanceId?: string }>
) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const ruleRepository = new RuleRepository(testTenantId, {
    dynamoDb,
    mongoDb,
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
    checksFor: [],
    types: [],
    typologies: [],
    sampleUseCases: '',

    ...rule,
  })

  const createdRuleInstance =
    await ruleInstanceRepository.createOrUpdateRuleInstance({
      type: rule.type ?? 'TRANSACTION',
      ruleId: createdRule.id as string,
      id: ruleInstance?.ruleInstanceId,
      logic: createdRule.defaultLogic,
      logicAggregationVariables: createdRule.defaultLogicAggregationVariables,
      baseCurrency: createdRule.defaultBaseCurrency,
      parameters: createdRule.defaultParameters,
      riskLevelParameters: createdRule.defaultRiskLevelParameters,
      action: createdRule.defaultAction,
      riskLevelActions: createdRule.defaultRiskLevelActions,
      status: 'ACTIVE',
      casePriority: createdRule.defaultCasePriority as Priority,
      nature: createdRule.defaultNature,
      labels: createdRule.labels,
      checksFor: createdRule.checksFor,
      mode: 'LIVE_SYNC',
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
  const mongoDb = await getMongoDbClient()
  const ruleRepository = new RuleRepository(testTenantId, {
    dynamoDb,
    mongoDb,
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
    cleanUps = await createUsersForTransactions(tenantId, transactions)
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
): Promise<Array<ConsumerUserMonitoringResult | BusinessUserMonitoringResult>> {
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
    | ConsumerUserMonitoringResult
    | BusinessUserMonitoringResult
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
    | ConsumerUserMonitoringResult
    | BusinessUserMonitoringResult
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
    | ConsumerUserMonitoringResult
    | BusinessUserMonitoringResult
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
  rules: Array<
    Partial<Rule> | Partial<RuleInstance & { ruleInstanceId?: string }>
  >
) {
  const cleanups: Array<() => void> = [
    async () => {
      return
    },
  ]

  beforeAll(async () => {
    for (const rule of rules) {
      const libraryRule = rule.id ? getRuleByRuleId(rule.id) : undefined
      let alertCreationDirection: AlertCreationDirection = 'AUTO'
      const v8Rule: Partial<Rule> = {}
      if (hasFeature('RULES_ENGINE_V8') && (rule as Rule).defaultParameters) {
        const libraryRuleV8 =
          libraryRule ??
          getRuleByImplementation((rule as Rule).ruleImplementationName ?? '')
        if (!libraryRuleV8?.defaultLogic) {
          throw new Error(`Rule ${rule.id} is not V8 compatible!`)
        }
        const r = rule as Rule
        const filters = {
          ...r.defaultFilters,
          ...(rule as RuleInstance).filters,
        }
        const {
          logic,
          logicAggregationVariables,
          alertCreationDirection: alertDirection,
          baseCurrency,
        } = getMigratedV8Config(
          libraryRuleV8.id,
          r.defaultParameters,
          filters
        ) ?? {}

        v8Rule.defaultLogic = logic
        v8Rule.defaultLogicAggregationVariables = logicAggregationVariables
        v8Rule.defaultBaseCurrency = baseCurrency
        if (alertDirection) {
          alertCreationDirection = alertDirection
        }
      }
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
            ...v8Rule,
          },
          {
            ...(omit(rule, 'id') as RuleInstance),
            alertConfig: {
              ...(rule as RuleInstance).alertConfig,
              alertCreationDirection,
            },
          }
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

export function createAllUserRuleTestCases(
  tenantId: string,
  testCase: AllUserRuleTestCase
) {
  const cleanups: Array<() => void> = []
  test(testCase.name, async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const rulesEngine = new RulesEngineService(tenantId, dynamoDb, mongoDb)
    const userIds = testCase.users.map((user) => user.userId)
    const hits = testCase.expectedHits

    const cleanUpsResult = (
      await Promise.all(
        testCase.users.map((user) => {
          return createUserIfNotExists(tenantId, user)
        })
      )
    ).flat()

    cleanups.push(...cleanUpsResult)

    const mapUserIdWithHit = zipObject(userIds, hits)
    const results = await rulesEngine.verifyAllUsersRules()

    Object.entries(mapUserIdWithHit).forEach(([userId, hit]) => {
      if (!hit) {
        if (results?.[userId]) {
          expect(getRuleHits([results[userId]])).toEqual([false])
        } else {
          expect(results?.[userId]).toBeUndefined()
        }
      } else {
        expect(getRuleHits([results[userId]])).toEqual([true])
      }
    })
  })

  afterAll(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
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
    if (hasFeature('RULES_ENGINE_V8')) {
      // V8 rules don't have description template (yet)
      return
    }
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

export interface AllUserRuleTestCase {
  name: string
  users: Array<Business | User>
  expectedHits: boolean[]
}

// For making sure a rule works the same w/ or w/o RULES_ENGINE_RULE_BASED_AGGREGATION feature flag
export function ruleVariantsTest(
  config: { aggregation: boolean; v8?: boolean },
  jestCallback: () => void
) {
  if (config.aggregation) {
    describe('database:dynamodb; rule-aggregation:on', () => {
      jestCallback()
    })
  }
  if (config.v8) {
    describe('database:dynamodb; V8', () => {
      withFeatureHook(['RULES_ENGINE_V8'])
      jestCallback()
    })
    describe('database:mongodb; V8', () => {
      withFeatureHook(['RULES_ENGINE_V8'])
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

export function testAggregationRebuild(
  tenantId: string,
  ruleConfig: Partial<Rule & RuleInstance>,
  transactions: Transaction[],
  expectedRebuiltAggregation: {
    origin: Array<any> | undefined
    destination: Array<any> | undefined
  }
) {
  describe('Test rule aggregation rebuild', () => {
    const TEST_RULE_INSTANCE_ID = 'TEST_RULE_INSTANCE_ID'
    const dynamoDb = getDynamoDbClient()
    setUpRulesHooks(tenantId, [
      { ...ruleConfig, ruleInstanceId: TEST_RULE_INSTANCE_ID },
    ])
    test('', async () => {
      // Save N-1 transactions
      const transactionRepository = new DynamoDbTransactionRepository(
        tenantId,
        dynamoDb
      )
      for (const transaction of transactions.slice(
        0,
        transactions.length - 1
      )) {
        await transactionRepository.saveTransaction(transaction)
      }

      // Update rule instance aggregation version
      const ruleRepository = new RuleRepository(tenantId, {
        dynamoDb: getDynamoDbClient(),
      })
      const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
        dynamoDb: getDynamoDbClient(),
      })
      const ruleInstance = (await ruleInstanceRepository.getRuleInstanceById(
        TEST_RULE_INSTANCE_ID
      )) as RuleInstance
      const rule = (await ruleRepository.getRuleById(
        ruleInstance?.ruleId ?? ''
      )) as Rule
      await ruleInstanceRepository.createOrUpdateRuleInstance({
        ...ruleInstance,
        updatedAt: Date.now(),
      })

      // Rebuild for the Nth transaction
      const lastTransaction = last(transactions)
      if (lastTransaction) {
        await bulkVerifyTransactions(tenantId, [lastTransaction], {
          autoCreateUser: true,
        })

        // Validate rebuilt aggregation
        const RuleClass = TRANSACTION_RULES[rule.ruleImplementationName ?? '']
        const ruleClassInstance = new (RuleClass as typeof TransactionRuleBase)(
          tenantId,
          {
            transaction: lastTransaction,
          },
          { parameters: rule.defaultParameters, filters: ruleInstance.filters },
          { ruleInstance, rule },
          {
            sanctionsService: new SanctionsService(tenantId),
            ibanService: new IBANService(tenantId),
            geoIpService: new GeoIPService(tenantId),
          },
          'DYNAMODB',
          dynamoDb,
          undefined
        ) as TransactionAggregationRule<any>

        const originAggregation = await ruleClassInstance.getRuleAggregations(
          'origin',
          0,
          Number.MAX_SAFE_INTEGER
        )
        const destinationAggregation =
          await ruleClassInstance.getRuleAggregations(
            'destination',
            0,
            Number.MAX_SAFE_INTEGER
          )
        expect(originAggregation?.map((v) => omit(v, 'ttl'))).toEqual(
          expectedRebuiltAggregation.origin
        )
        expect(destinationAggregation?.map((v) => omit(v, 'ttl'))).toEqual(
          expectedRebuiltAggregation.destination
        )
      }
    })
  })
}

export function getTestRuleInstance(
  partialRuleInstance: Partial<RuleInstance>
): RuleInstance {
  return {
    id: uuidv4(),
    casePriority: 'P1',
    type: 'TRANSACTION',
    nature: 'AML',
    labels: [],
    checksFor: [],
    mode: 'LIVE_SYNC',
    ...partialRuleInstance,
  }
}
