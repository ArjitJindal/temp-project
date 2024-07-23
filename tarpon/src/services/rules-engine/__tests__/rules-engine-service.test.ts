import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { omit } from 'lodash'
import { RulesEngineService } from '..'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import { RiskRepository } from '../../risk-scoring/repositories/risk-repository'
import { RuleInstanceRepository } from '../repositories/rule-instance-repository'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { RuleJsonLogicEvaluator } from '../v8-engine'
import { TransactionAmountRuleParameters } from '../transaction-rules/transaction-amount'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  bulkVerifyTransactions,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { getTestTransactionEvent } from '@/test-utils/transaction-event-test-utils'
import { withContext } from '@/core/utils/context'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import dayjs from '@/utils/dayjs'

const RULE_INSTANCE_ID_MATCHER = expect.stringMatching(/^[A-Z0-9.-]+$/)

const dynamoDb = getDynamoDbClient()

dynamoDbSetupHook()
withLocalChangeHandler()
describe('Verify Transaction', () => {
  test('Verify Transaction: returns empty executed rules if no rules are configured', async () => {
    const rulesEngine = new RulesEngineService(getTestTenantId(), dynamoDb)
    const transaction = getTestTransaction({ transactionId: 'dummy' })
    const result = await rulesEngine.verifyTransaction(transaction)
    expect(result).toEqual({
      transactionId: 'dummy',
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
    })
  })

  describe('Verify Transaction: executed rules', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
      },
    ])

    test('returns executed rules', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result = await rulesEngine.verifyTransaction(transaction)
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: true,
            nature: 'AML',
            labels: [],
            isShadow: false,
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
        status: 'FLAG',
        hitRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            nature: 'AML',
            labels: [],
            isShadow: false,
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction while being a shadow rule', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
        mode: 'SHADOW_SYNC',
      },
    ])

    test('returns executed rules', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result = await rulesEngine.verifyTransaction(transaction)
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: true,
            nature: 'AML',
            labels: [],
            isShadow: true,
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
        status: 'ALLOW',
        hitRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            nature: 'AML',
            labels: [],
            isShadow: true,
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction with filters', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
        filters: { whitelistUsers: { userIds: ['1'] } },
      },
    ])
    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({ userId: '1' }),
      getTestUser({ userId: '2' }),
    ])

    test('rule is not run', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({
        transactionId: 'dummy',
        originUserId: '1',
        destinationUserId: '2',
      })
      const result = await rulesEngine.verifyTransaction(transaction)
      const expectedRuleResult = {
        ruleId: 'TEST-R-1',
        ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
        ruleName: 'test rule name',
        ruleDescription: '',
        ruleAction: 'FLAG',
        nature: 'AML',
        labels: [],
        isShadow: false,
        ruleHitMeta: {
          hitDirections: ['DESTINATION'],
        },
      }
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [
          {
            ...expectedRuleResult,
            ruleHit: true,
          },
        ],
        status: 'FLAG',
        hitRules: [expectedRuleResult],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction: executed rules (non-hit)', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-non-hit-rule',
        type: 'TRANSACTION',
      },
    ])

    test('returns executed rules', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result = await rulesEngine.verifyTransaction(transaction)
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: false,
            nature: 'AML',
            labels: [],
            isShadow: false,
          },
        ],
        status: 'ALLOW',
        hitRules: [],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction: skip already verified transaction', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
      },
    ])

    test('returns executed rules', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result1 = await rulesEngine.verifyTransaction(transaction)
      const result2 = await rulesEngine.verifyTransaction(transaction)
      expect(result1.executedRules).toEqual(result2.executedRules)
    })
  })

  describe('Verify Transaction with user direction filter', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
        filters: { checkDirection: 'DESTINATION' },
      },
    ])

    test('only destination user is hit', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({
        transactionId: 'dummy',
        originUserId: '1',
      })
      const result = await rulesEngine.verifyTransaction(transaction)
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: true,
            nature: 'AML',
            labels: [],
            isShadow: false,
            ruleHitMeta: {
              hitDirections: ['DESTINATION'],
            },
          },
        ],
        status: 'FLAG',
        hitRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            nature: 'AML',
            labels: [],
            isShadow: false,
            ruleHitMeta: {
              hitDirections: ['DESTINATION'],
            },
          },
        ],
      } as TransactionMonitoringResult)
    })
  })
})

describe('Verify Transaction Event', () => {
  describe('Verify Transaction Event: executed rules', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
      },
    ])

    test('returns executed rules', async () => {
      const transactionRepository = new DynamoDbTransactionRepository(
        TEST_TENANT_ID,
        dynamoDb
      )
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({
        transactionId: 'dummy',
        originDeviceData: {
          deviceIdentifier: 'deviceIdentifier',
        },
      })
      const result1 = await rulesEngine.verifyTransaction(transaction)

      expect(
        (
          await transactionRepository.getTransactionById(
            transaction.transactionId as string
          )
        )?.originDeviceData
      ).toEqual({
        deviceIdentifier: 'deviceIdentifier',
      })

      const transactionEvent = getTestTransactionEvent({
        eventId: '1',
        transactionId: transaction.transactionId,
        transactionState: 'SUCCESSFUL',
        updatedTransactionAttributes: {
          originDeviceData: {
            ipAddress: 'ipAddress',
          },
        },
      })
      const result2 = await rulesEngine.verifyTransactionEvent(transactionEvent)
      const latestTransaction = await transactionRepository.getTransactionById(
        transaction.transactionId as string
      )
      expect(result2).toEqual({
        eventId: transactionEvent.eventId,
        transaction: omit(latestTransaction, ['executedRules', 'hitRules']),
        executedRules: result1.executedRules,
        hitRules: result1.hitRules,
      })
      expect(latestTransaction?.originDeviceData).toEqual({
        deviceIdentifier: 'deviceIdentifier',
        ipAddress: 'ipAddress',
      })
    })

    test("run rules even if the transaction doesn't have updates", async () => {
      const transactionRepository = new DynamoDbTransactionRepository(
        TEST_TENANT_ID,
        dynamoDb
      )
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({
        transactionId: 'dummy-2',
      })
      const result1 = await rulesEngine.verifyTransaction(transaction)

      const transactionEvent = getTestTransactionEvent({
        eventId: '2',
        transactionId: transaction.transactionId,
        transactionState: 'SUCCESSFUL',
        updatedTransactionAttributes: undefined,
      })
      const result2 = await rulesEngine.verifyTransactionEvent(transactionEvent)
      const latestTransaction = await transactionRepository.getTransactionById(
        transaction.transactionId as string
      )
      expect(result2).toEqual({
        eventId: transactionEvent.eventId,
        transaction: omit(latestTransaction, ['executedRules', 'hitRules']),
        executedRules: result1.executedRules,
        hitRules: result1.hitRules,
      })
    })
  })

  describe('Verify Transaction: risk-level parameters', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
        defaultRiskLevelParameters: {
          VERY_HIGH: {},
          HIGH: {},
          MEDIUM: {},
          LOW: {},
          VERY_LOW: {},
        },
        defaultRiskLevelActions: {
          VERY_HIGH: 'BLOCK',
          HIGH: 'BLOCK',
          MEDIUM: 'BLOCK',
          LOW: 'BLOCK',
          VERY_LOW: 'BLOCK',
        },
      },
    ])
    setUpUsersHooks(TEST_TENANT_ID, [getTestUser({ userId: '1' })])

    test('returns risk-level action with PULSE feature flag', async () => {
      await withContext(
        async () => {
          const mongoDb = await getMongoDbClient()
          const riskRepository = new RiskRepository(TEST_TENANT_ID, {
            dynamoDb,
            mongoDb,
          })
          await riskRepository.createOrUpdateManualDRSRiskItem('1', 'HIGH')

          const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
          const transaction = getTestTransaction({
            transactionId: '1',
            originUserId: '1',
          })
          const result = await rulesEngine.verifyTransaction(transaction)
          expect(result).toEqual({
            transactionId: '1',
            executedRules: [
              {
                ruleId: 'TEST-R-1',
                ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
                ruleName: 'test rule name',
                ruleDescription: '',
                ruleAction: 'BLOCK',
                ruleHit: true,
                nature: 'AML',
                labels: [],
                isShadow: false,
                ruleHitMeta: {
                  hitDirections: ['ORIGIN', 'DESTINATION'],
                },
              },
            ],
            status: 'BLOCK',
            hitRules: [
              {
                ruleId: 'TEST-R-1',
                ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
                ruleName: 'test rule name',
                ruleDescription: '',
                ruleAction: 'BLOCK',
                nature: 'AML',
                labels: [],
                isShadow: false,
                ruleHitMeta: {
                  hitDirections: ['ORIGIN', 'DESTINATION'],
                },
              },
            ],
          } as TransactionMonitoringResult)
        },
        { features: ['RISK_LEVELS'] }
      )
    })

    test('returns normal action without PULSE feature flag', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({ transactionId: '2' })
      const result = await rulesEngine.verifyTransaction(transaction)
      expect(result).toEqual({
        transactionId: '2',
        executedRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: true,
            nature: 'AML',
            labels: [],
            isShadow: false,
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
        status: 'FLAG',
        hitRules: [
          {
            ruleId: 'TEST-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            labels: [],
            isShadow: false,
            nature: 'AML',
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
      } as TransactionMonitoringResult)
    })
  })
})

describe('Verify Transaction for Simulation', () => {
  dynamoDbSetupHook()

  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'TEST-R-1',
      ruleImplementationName: 'tests/test-success-rule',
      type: 'TRANSACTION',
    },
  ])

  test('Returns rule result and no side effects are done', async () => {
    const rulesEngine = new RulesEngineService(getTestTenantId(), dynamoDb)
    const testTransactionId = 'dummy'
    const testRuleInstanceId = 'abc'
    const transaction = getTestTransaction({ transactionId: testTransactionId })
    const result = await rulesEngine.verifyTransactionForSimulation(
      transaction,
      {
        id: 'abc',
        ruleId: 'TEST-R-1',
        casePriority: 'P1',
        parameters: {},
        action: 'BLOCK',
        type: 'TRANSACTION',
        nature: 'AML',
        labels: [],
        checksFor: [],
        mode: 'LIVE_SYNC',
      }
    )
    expect(result).toEqual({
      ruleId: 'TEST-R-1',
      ruleInstanceId: testRuleInstanceId,
      ruleName: 'test rule name',
      ruleDescription: '',
      ruleAction: 'BLOCK',
      ruleHit: true,
      labels: [],
      isShadow: false,
      nature: 'AML',
      ruleHitMeta: {
        hitDirections: ['ORIGIN', 'DESTINATION'],
      },
    })

    // Check transaction not saved and aggregation not run
    const dynamoDbData = await dynamoDb.send(
      new ScanCommand({ TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME })
    )
    expect(dynamoDbData.Count).toBe(0)
    const transactionRepository = new MongoDbTransactionRepository(
      TEST_TENANT_ID,
      await getMongoDbClient()
    )
    expect(
      await transactionRepository.getInternalTransactionById(testTransactionId)
    ).toBeNull()

    // Check rule instance is not saved
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })
    expect(
      await ruleInstanceRepository.getRuleInstanceById(testRuleInstanceId)
    ).toBeNull()
  })

  test('Applies manual action to transaction', async () => {
    const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
    const transaction = getTestTransaction({ status: 'SUSPEND' })
    const t = await rulesEngine.verifyTransaction(transaction)
    const mongoDb = await getMongoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      TEST_TENANT_ID,
      mongoDb
    )
    const transactionEventRepository = new TransactionEventRepository(
      TEST_TENANT_ID,
      { mongoDb, dynamoDb }
    )
    const txnBefore = await transactionRepository.getInternalTransactionById(
      t.transactionId
    )
    const eventsBefore = await transactionEventRepository.getTransactionEvents(
      t.transactionId
    )
    expect(txnBefore?.status).toEqual('FLAG')
    expect(eventsBefore.length).toEqual(1)

    await rulesEngine.applyTransactionAction(
      {
        transactionIds: [t.transactionId],
        action: 'ALLOW',
        reason: ['Anti-money laundering'],
        comment: 'test',
      },
      'user1'
    )
    const txn = await transactionRepository.getInternalTransactionById(
      t.transactionId
    )
    expect(txn?.status).toEqual('ALLOW')

    const eventsAfter = await transactionEventRepository.getTransactionEvents(
      t.transactionId
    )
    expect(eventsAfter.length).toEqual(2)
  })
})

describe('Verify Transaction: V8 engine', () => {
  withFeatureHook(['RULES_ENGINE_V8'])

  describe('Simple case', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('Basic test', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        })
      )
      expect(result1).toEqual({
        transactionId: 'tx-1',
        status: 'ALLOW',
        executedRules: [
          {
            ruleId: 'RC-V8-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: false,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'agg:test': 1,
                },
              },
              {
                direction: 'DESTINATION',
                value: {
                  'agg:test': 0,
                },
              },
            ],
            nature: 'AML',
            labels: [],
            isShadow: false,
          },
        ],
        hitRules: [],
      } as TransactionMonitoringResult)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        })
      )
      expect(result2).toEqual({
        transactionId: 'tx-2',
        status: 'FLAG',
        executedRules: [
          {
            ruleId: 'RC-V8-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            ruleHit: true,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'agg:test': 2,
                },
              },
              {
                direction: 'DESTINATION',
                value: {
                  'agg:test': 0,
                },
              },
            ],
            nature: 'AML',
            labels: [],
            isShadow: false,
          },
        ],
        hitRules: [
          {
            ruleId: 'RC-V8-R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHitMeta: {
              hitDirections: ['ORIGIN'],
            },
            labels: [],
            isShadow: false,
            nature: 'AML',
          },
        ],
      } as TransactionMonitoringResult)
    })
  })

  describe('with aggregation group by field', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationGroupByFieldKey: 'TRANSACTION:type',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('aggregation values are grouped', async () => {
      const results = await bulkVerifyTransactions(
        TEST_TENANT_ID,
        [
          getTestTransaction({
            type: 'TRANSFER',
            originUserId: 'U-1',
            timestamp: 1713172716112,
          }),
          getTestTransaction({
            type: 'DEPOSIT',
            originUserId: 'U-1',
            timestamp: 1713172716113,
          }),
          getTestTransaction({
            type: 'TRANSFER',
            originUserId: 'U-1',
            timestamp: 1713172716114,
          }),
        ],
        { autoCreateUser: true }
      )
      expect(results.map((v) => v.status !== 'ALLOW')).toEqual([
        false,
        false,
        true,
      ])
    })
  })

  describe('Aggregation group by field with transaction origin amount', () => {
    const TEST_TENANT_ID = getTestTenantId()
    // Transaction amount is by default by default converted to base currency
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-2',
        defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationGroupByFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            baseCurrency: 'USD',
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('aggregation values are grouped', async () => {
      const results = await bulkVerifyTransactions(
        TEST_TENANT_ID,
        [
          getTestTransaction({
            type: 'TRANSFER',
            originUserId: 'U-1',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'USD',
            },
            timestamp: 1713172716112,
          }),
          getTestTransaction({
            type: 'DEPOSIT',
            originUserId: 'U-1',
            originAmountDetails: {
              transactionAmount: 200,
              transactionCurrency: 'USD',
            },
            timestamp: 1713172716113,
          }),
          getTestTransaction({
            type: 'TRANSFER',
            originUserId: 'U-1',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'USD',
            },
            timestamp: 1713172716114,
          }),
          getTestTransaction({
            type: 'TRANSFER',
            originUserId: 'U-1',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'USD',
            },
            timestamp: 1713172716115,
          }),
          getTestTransaction({
            type: 'TRANSFER',
            originUserId: 'U-1',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
            timestamp: 1713172716116,
          }),
        ],
        { autoCreateUser: true }
      )
      expect(results.map((v) => v.status !== 'ALLOW')).toEqual([
        false,
        false,
        true,
        true,
        false,
      ])
    })
  })

  describe('"All time" granularity', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-2',
        defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 0, granularity: 'all_time' },
              end: { units: 0, granularity: 'day' },
            },
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      await rulesEngine.verifyTransaction(
        getTestTransaction({
          timestamp: dayjs('2020-01-01').valueOf(),
          transactionId: 'tx-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        })
      )
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          timestamp: dayjs('2024-01-01').valueOf(),
          transactionId: 'tx-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        })
      )
      expect(result2.status).toBe('FLAG')
    })
  })
  describe('Aggregation variable with user filter', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-3',
        defaultLogic: { and: [{ '>=': [{ var: 'agg:test-filter' }, 1] }] },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test-filter',
            type: 'USER_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:transactionId',
            aggregationFunc: 'COUNT',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            filtersLogic: {
              and: [{ '==': [{ var: 'CONSUMER_USER:userId__SENDER' }, 'U-1'] }],
            },
          },
        ],
      },
    ])
    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({ userId: 'U-1' }),
      getTestUser({ userId: 'U-2' }),
    ])
    test('Sender User matches the filter (hit)', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          originUserId: 'U-2',
          transactionId: 'tx-1',
          destinationUserId: 'U-1',
        })
      )
      expect(result1.status).toBe('ALLOW')
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          originUserId: 'U-1',
          transactionId: 'tx-2',
          destinationUserId: 'U-2',
        })
      )
      expect(result2.status).toBe('FLAG')
    })
  })
})

describe('Verify Transaction V8 engine with Update Aggregation', () => {
  withFeatureHook(['RULES_ENGINE_V8'])

  const mock = jest.spyOn(
    RuleJsonLogicEvaluator.prototype,
    'updateAggregationVariable'
  )

  const TEST_TENANT_ID = getTestTenantId()
  const aggregationVariables: RuleAggregationVariable = {
    key: 'agg:test',
    type: 'PAYMENT_DETAILS_TRANSACTIONS',
    transactionDirection: 'SENDING',
    aggregationFieldKey: 'TRANSACTION:transactionId',
    aggregationFunc: 'COUNT',
    timeWindow: {
      start: { units: 1, granularity: 'day' },
      end: { units: 0, granularity: 'day' },
    },
  }

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-V8-R-1',
      defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
      defaultLogicAggregationVariables: [aggregationVariables],
      type: 'TRANSACTION',
    },
    {
      id: 'RC-V8-R-2',
      defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
      defaultLogicAggregationVariables: [aggregationVariables],
      type: 'TRANSACTION',
    },
  ])

  test('Checks aggregation variable is updated only once', async () => {
    mock.mockClear()
    const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)

    await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-1',
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      })
    )

    expect(mock).toBeCalledTimes(1)
  })
})

describe('Verify Transaction: V8 engine course grained aggregation', () => {
  withFeatureHook(['RULES_ENGINE_V8'])

  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-V8-R-1',
      defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
      defaultLogicAggregationVariables: [
        {
          key: 'agg:test',
          type: 'PAYMENT_DETAILS_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 1, granularity: 'month' },
            end: { units: 0, granularity: 'month' },
          },
        },
      ],
      type: 'TRANSACTION',
    },
  ])

  test('executes the json logic - hit for course grained aggregation', async () => {
    const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
    const result1 = await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-1',
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      })
    )
    expect(result1).toEqual({
      transactionId: 'tx-1',
      status: 'ALLOW',
      executedRules: [
        {
          ruleId: 'RC-V8-R-1',
          ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHit: false,
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:test': 1,
              },
            },
          ],
          nature: 'AML',
          labels: [],
          isShadow: false,
        },
      ],
      hitRules: [],
    } as TransactionMonitoringResult)
    const result2 = await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-2',
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
      })
    )
    expect(result2).toEqual({
      transactionId: 'tx-2',
      status: 'FLAG',
      executedRules: [
        {
          ruleId: 'RC-V8-R-1',
          ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHitMeta: {
            hitDirections: ['ORIGIN'],
          },
          ruleHit: true,
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:test': 2,
              },
            },
          ],
          nature: 'AML',
          labels: [],
          isShadow: false,
        },
      ],
      hitRules: [
        {
          ruleId: 'RC-V8-R-1',
          ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHitMeta: {
            hitDirections: ['ORIGIN'],
          },
          labels: [],
          isShadow: false,
          nature: 'AML',
        },
      ],
    } as TransactionMonitoringResult)
  })
})

describe('Verify Transaction: V8 engine with second/minute granularity', () => {
  withFeatureHook(['RULES_ENGINE_V8'])

  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-V8-R-1',
      defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 0] }] },
      defaultLogicAggregationVariables: [
        {
          key: 'agg:test',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 5, granularity: 'minute' },
            end: { units: 10, granularity: 'second' },
          },
        },
      ],
      type: 'TRANSACTION',
    },
  ])

  test('executes the json logic', async () => {
    const t1 = dayjs()
    const t2 = t1.add(9, 'second')
    const t3 = t2.add(5, 'second') // should see t1
    const t4 = t3.add(5, 'minute').subtract(1, 'second') // should see t3
    const t5 = t3.add(5, 'minute').add(1, 'second')
    const results = await bulkVerifyTransactions(
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: 'U-1',
          timestamp: t1.valueOf(),
        }),
        getTestTransaction({
          originUserId: 'U-1',
          timestamp: t2.valueOf(),
        }),
        getTestTransaction({
          originUserId: 'U-1',
          timestamp: t3.valueOf(),
        }),
        getTestTransaction({
          originUserId: 'U-1',
          timestamp: t4.valueOf(),
        }),
        getTestTransaction({
          originUserId: 'U-1',
          timestamp: t5.valueOf(),
        }),
      ],
      { autoCreateUser: true }
    )
    expect(results.map((v) => v.status !== 'ALLOW')).toEqual([
      false,
      false,
      true,
      true,
      false,
    ])
  })
})

describe('Verify Transaction: V8 engine with rolling basis', () => {
  withFeatureHook(['RULES_ENGINE_V8'])

  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-V8-R-1',
      defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
      defaultLogicAggregationVariables: [
        {
          key: 'agg:test',
          type: 'PAYMENT_DETAILS_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 1, granularity: 'month', rollingBasis: true },
            end: { units: 0, granularity: 'month', rollingBasis: true },
          },
        },
      ],
      type: 'TRANSACTION',
    },
  ])

  test('executes the json logic - not hit for rolling basis ', async () => {
    /** This Test would fail if we use incorrectly use course grained aggregation(month) for rolling basis,
     *  as it would use complete previous month */

    const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
    const result1 = await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-1',
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
        timestamp: dayjs('2023-12-01T20:00:00').valueOf(),
      })
    )
    expect(result1).toEqual({
      transactionId: 'tx-1',
      status: 'ALLOW',
      executedRules: [
        {
          ruleId: 'RC-V8-R-1',
          ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHit: false,
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:test': 1,
              },
            },
          ],
          nature: 'AML',
          labels: [],
          isShadow: false,
        },
      ],
      hitRules: [],
    } as TransactionMonitoringResult)
    const result2 = await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-2',
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '123',
        },
        timestamp: dayjs('2024-01-03T19:00:00').valueOf(),
      })
    )
    expect(result2).toEqual({
      transactionId: 'tx-2',
      status: 'ALLOW',
      executedRules: [
        {
          ruleId: 'RC-V8-R-1',
          ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHit: false,
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:test': 1,
              },
            },
          ],
          nature: 'AML',
          labels: [],
          isShadow: false,
        },
      ],
      hitRules: [],
    } as TransactionMonitoringResult)
  })

  describe('Verify saved payment details for consumer user', () => {
    withFeatureHook(['RULES_ENGINE_V8'])

    const TEST_TENANT_ID = getTestTenantId()
    const userId1 = 'U-1'
    const userId2 = 'U-2'
    const userId3 = 'U-3'

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-2',
        ruleId: 'RC-2',
        logicEntityVariables: [
          {
            key: 'CONSUMER_USER:savedPaymentDetails__SENDER',
            entityKey: 'CONSUMER_USER:savedPaymentDetails__SENDER',
          },
        ],
        defaultAction: 'FLAG',
        defaultLogic: {
          and: [
            {
              some: [
                {
                  var: 'CONSUMER_USER:savedPaymentDetails__SENDER',
                },
                {
                  '==': [
                    {
                      var: 'method',
                    },
                    'CARD',
                  ],
                },
              ],
            },
          ],
        },
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: userId1,
        savedPaymentDetails: [
          {
            method: 'CARD',
            cardFingerprint: '123',
          },
        ],
      }),
      getTestUser({
        userId: userId2,
        savedPaymentDetails: [
          {
            method: 'CHECK',
            checkIdentifier: '123',
          },
        ],
      }),
      getTestUser({
        userId: userId3,
        savedPaymentDetails: [
          {
            method: 'CARD',
            cardFingerprint: '123',
          },
          {
            method: 'ACH',
            accountNumber: '123',
          },
        ],
      }),
    ])

    test('executes the json logic', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-1',
          originUserId: userId1,
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        })
      )
      expect(result1).toEqual({
        transactionId: 'tx-1',
        status: 'FLAG',
        executedRules: [
          {
            ruleId: 'RC-2',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: true,
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:savedPaymentDetails__SENDER': {
                    method: ['CARD'],
                  },
                },
              },
            ],
            nature: 'AML',
            labels: [],
            isShadow: false,
          },
        ],
        hitRules: [
          {
            ruleId: 'RC-2',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            labels: [],
            isShadow: false,
            nature: 'AML',
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
      } as TransactionMonitoringResult)

      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-3',
          originUserId: userId3,
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        })
      )

      expect(result2).toEqual({
        transactionId: 'tx-3',
        status: 'FLAG',
        executedRules: [
          {
            ruleId: 'RC-2',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: true,
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:savedPaymentDetails__SENDER': {
                    method: ['CARD', 'ACH'],
                  },
                },
              },
            ],
            nature: 'AML',
            labels: [],
            isShadow: false,
          },
        ],
        hitRules: [
          {
            ruleId: 'RC-2',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            labels: [],
            isShadow: false,
            nature: 'AML',
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
      } as TransactionMonitoringResult)
    })

    test('executes the json logic - not hit', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-2',
          originUserId: userId2,
          originPaymentDetails: {
            method: 'CHECK',
            checkIdentifier: '123',
          },
        })
      )
      expect(result1).toEqual({
        transactionId: 'tx-2',
        status: 'ALLOW',
        executedRules: [
          {
            ruleId: 'RC-2',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: '',
            ruleAction: 'FLAG',
            ruleHit: false,
            vars: [
              {
                direction: 'ORIGIN',
                value: {
                  'CONSUMER_USER:savedPaymentDetails__SENDER': {
                    method: ['CHECK'],
                  },
                },
              },
            ],
            nature: 'AML',
            labels: [],
            isShadow: false,
          },
        ],
        hitRules: [],
      } as TransactionMonitoringResult)
    })
  })
})

describe('Run v2 rules on v8 engine', () => {
  withFeatureHook(['RULES_ENGINE_V8', 'RULES_ENGINE_V8_FOR_V2_RULES'])

  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-2',
      parameters: {
        transactionAmountThreshold: {
          USD: 100,
        },
      } as TransactionAmountRuleParameters,
      ruleImplementationName: 'transaction-amount',
    },
  ])

  test('executes the json logic - hit for course grained aggregation', async () => {
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })

    const data = await ruleInstanceRepository.getAllRuleInstances()

    expect(data[0].logic).not.toBeUndefined()

    const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)

    const v8Mock = jest.spyOn(RuleJsonLogicEvaluator.prototype, 'evaluate')

    await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-1',
        originAmountDetails: {
          transactionCurrency: 'USD',
          transactionAmount: 101,
        },
      })
    )

    expect(v8Mock).toBeCalledTimes(1)
  })
})

describe('Verify Transaction: V8 engine with Deploying status', () => {
  withFeatureHook(['RULES_ENGINE_V8'])

  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'RC-deploying',
      defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 1] }] },
      defaultLogicAggregationVariables: [
        {
          key: 'agg:test',
          type: 'USER_TRANSACTIONS',
          userDirection: 'SENDER',
          transactionDirection: 'SENDING',
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { units: 1, granularity: 'day' },
            end: { units: 0, granularity: 'day' },
          },
        },
      ],
      type: 'TRANSACTION',
      status: 'DEPLOYING',
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [getTestUser({ userId: '1' })])

  test('transactions created duing Deploying should be put to aggregation data', async () => {
    const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
    const ruleInstanceRepository = new RuleInstanceRepository(TEST_TENANT_ID, {
      dynamoDb,
    })

    const result1 = await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-1',
        originUserId: '1',
      })
    )
    expect(result1).toEqual({
      transactionId: 'tx-1',
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
    } as TransactionMonitoringResult)

    await ruleInstanceRepository.updateRuleInstanceStatus(
      'RC-deploying',
      'ACTIVE'
    )
    const result2 = await rulesEngine.verifyTransaction(
      getTestTransaction({
        transactionId: 'tx-2',
        originUserId: '1',
      })
    )
    expect(result2).toEqual({
      transactionId: 'tx-2',
      status: 'FLAG',
      executedRules: [
        {
          ruleId: 'RC-deploying',
          ruleInstanceId: 'RC-deploying',
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHit: true,
          labels: [],
          nature: 'AML',
          ruleHitMeta: {
            hitDirections: ['ORIGIN'],
          },
          vars: [
            {
              direction: 'ORIGIN',
              value: {
                'agg:test': 2,
              },
            },
          ],
          isShadow: false,
        },
      ],
      hitRules: [
        {
          ruleId: 'RC-deploying',
          ruleInstanceId: 'RC-deploying',
          ruleName: 'test rule name',
          ruleDescription: '',
          ruleAction: 'FLAG',
          ruleHitMeta: {
            hitDirections: ['ORIGIN'],
          },
          labels: [],
          nature: 'AML',
          isShadow: false,
        },
      ],
    } as TransactionMonitoringResult)
  })
})
