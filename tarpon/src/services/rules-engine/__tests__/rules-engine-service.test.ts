import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { omit } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { RulesEngineService } from '..'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import { RiskRepository } from '../../risk-scoring/repositories/risk-repository'
import { RuleInstanceRepository } from '../repositories/rule-instance-repository'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { TransactionAmountRuleParameters } from '../transaction-rules/transaction-amount'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  bulkVerifyTransactions,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import {
  disableAsyncRulesInTest,
  enableAsyncRulesInTest,
  getTestTransaction,
} from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { getTestTransactionEvent } from '@/test-utils/transaction-event-test-utils'
import { withContext } from '@/core/utils/context'
import {
  createConsumerUser,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import dayjs from '@/utils/dayjs'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import {
  getTestRiskFactor,
  setUpRiskFactorsHook,
} from '@/test-utils/pulse-test-utils'
import { TenantService } from '@/services/tenants'

const RULE_INSTANCE_ID_MATCHER = expect.stringMatching(/^[A-Z0-9.-]+$/)

const dynamoDb = getDynamoDbClient()

dynamoDbSetupHook()
withLocalChangeHandler()
describe('Verify Transaction', () => {
  const TEST_TENANT_ID = getTestTenantId()
  test('Verify Transaction: returns empty executed rules if no rules are configured', async () => {
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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

  describe('Verify Transaction: executed rules async', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'TEST-R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
      },
      {
        id: 'TEST-R-2',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'ASYNC',
      },
    ])

    test('returns executed rules (w/o async rules)', async () => {
      disableAsyncRulesInTest()
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      await rulesEngine.verifyTransaction(transaction)
      const transactionRepository = new DynamoDbTransactionRepository(
        TEST_TENANT_ID,
        dynamoDb
      )
      const transactionResult = await transactionRepository.getTransactionById(
        transaction.transactionId as string
      )
      expect(transactionResult).toEqual({
        ...transaction,
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

    test('returns executed rules (w/ async rules)', async () => {
      enableAsyncRulesInTest()
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const transaction = getTestTransaction({ transactionId: 'dummy-2' })
      await rulesEngine.verifyTransaction(transaction)
      const transactionRepository = new DynamoDbTransactionRepository(
        TEST_TENANT_ID,
        dynamoDb
      )
      const transactionResult = await transactionRepository.getTransactionById(
        transaction.transactionId as string
      )
      expect(transactionResult).toEqual({
        ...transaction,
        transactionId: 'dummy-2',
        status: 'FLAG',
        executedRules: [
          {
            ruleId: 'TEST-R-2',
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
        hitRules: [
          {
            ruleId: 'TEST-R-2',
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
        ruleRunMode: 'SHADOW',
        ruleExecutionMode: 'SYNC',
      },
    ])

    test('returns executed rules', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
      },
      {
        id: 'TEST-R-2',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'ASYNC',
      },
    ])

    test('returns executed rules', async () => {
      disableAsyncRulesInTest()
      const transactionRepository = new DynamoDbTransactionRepository(
        TEST_TENANT_ID,
        dynamoDb
      )
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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

      await rulesEngine.verifyAsyncRulesTransactionEvent(
        latestTransaction as Transaction,
        transactionEvent.eventId as string,
        getTestUser({ userId: transaction.originUserId }),
        getTestUser({ userId: transaction.destinationUserId })
      )

      const transactionResult = await transactionRepository.getTransactionById(
        transaction.transactionId as string
      )

      expect(transactionResult).toEqual({
        ...latestTransaction,
        transactionId: 'dummy',
        status: 'FLAG',
        executedRules: [
          {
            ruleId: 'TEST-R-2',
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
        hitRules: [
          {
            ruleId: 'TEST-R-2',
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
      })

      const transactionEventRepository = new TransactionEventRepository(
        TEST_TENANT_ID,
        { dynamoDb }
      )

      const events = await transactionEventRepository.getTransactionEvents(
        transaction.transactionId as string
      )

      expect(events.length).toEqual(2)

      const lastEvent = events.find((e) => e.eventId === '1')

      expect(lastEvent?.executedRules).toEqual([
        {
          ruleId: 'TEST-R-2',
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
      ])
    })

    test("run rules even if the transaction doesn't have updates", async () => {
      const transactionRepository = new DynamoDbTransactionRepository(
        TEST_TENANT_ID,
        dynamoDb
      )
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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

          const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
          const rulesEngine = new RulesEngineService(
            TEST_TENANT_ID,
            dynamoDb,
            logicEvaluator
          )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )
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
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
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
      new ScanCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(TEST_TENANT_ID),
      })
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
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )
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
            includeCurrentEntity: true,
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
  describe('Simple case -  last n transactions', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: { and: [{ '>': [{ var: 'agg:test' }, 200] }] },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'SUM',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            lastNEntities: 2,
            baseCurrency: 'USD',
            includeCurrentEntity: true,
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const timestamp = dayjs().valueOf()
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp,
        })
      )
      expect(result1.executedRules.length).toBe(1)
      expect(result1.hitRules.length).toBe(0)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 1,
        })
      )
      expect(result2.executedRules.length).toBe(1)
      expect(result2.hitRules.length).toBe(0)
      const result3 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-3',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 2,
        })
      )
      expect(result3.executedRules.length).toBe(1)
      expect(result3.hitRules.length).toBe(0)
      const result4 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-4',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 200,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 3,
        })
      )
      expect(result4.executedRules.length).toBe(1)
      expect(result4.hitRules.length).toBe(1)
    })
  })

  describe('Simple case check with last transaction -  last n transactions', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: {
          and: [
            {
              '<': [
                { var: 'agg:testlastn' },
                { var: 'TRANSACTION:originAmountDetails-transactionAmount' },
              ],
            },
          ],
        },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:testlastn',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'SUM',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            lastNEntities: 1,
            baseCurrency: 'USD',
            includeCurrentEntity: false,
          },
        ],
        logicEntityVariables: [
          {
            key: 'TRANSACTION:originAmountDetails-transactionAmount',
            entityKey: 'TRANSACTION:originAmountDetails-transactionAmount',
          },
        ],
        type: 'TRANSACTION',
        defaultBaseCurrency: 'USD',
      },
    ])

    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const timestamp = dayjs().valueOf()
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp,
        })
      )
      expect(result1.executedRules.length).toBe(1)
      expect(result1.hitRules.length).toBe(0)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 200,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 1000,
        })
      )
      expect(result2.executedRules.length).toBe(1)
      expect(result2.hitRules.length).toBe(1)
      const result3 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-3',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 150,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 2000,
        })
      )
      expect(result3.executedRules.length).toBe(1)
      expect(result3.hitRules.length).toBe(0)
      const result4 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-4',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 250,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 3000,
        })
      )
      expect(result4.executedRules.length).toBe(1)
      expect(result4.hitRules.length).toBe(1)
    })
  })

  describe('Simple case check with last transaction -  last n transactions  - unique count', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: {
          and: [
            {
              '==': [{ var: 'agg:testlastn' }, 1],
            },
          ],
        },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:testlastn',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'UNIQUE_COUNT',
            timeWindow: {
              start: { units: 0, granularity: 'all_time' },
              end: { units: 0, granularity: 'now' },
            },
            lastNEntities: 2,
            baseCurrency: 'USD',
            includeCurrentEntity: true,
          },
        ],
        type: 'TRANSACTION',
        defaultBaseCurrency: 'USD',
      },
    ])

    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const timestamp = dayjs().valueOf()
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp,
        })
      )
      expect(result1.executedRules.length).toBe(1)
      expect(result1.hitRules.length).toBe(0)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 1000,
        })
      )
      expect(result2.executedRules.length).toBe(1)
      expect(result2.hitRules.length).toBe(1)
      const result3 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-3',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 200,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 2000,
        })
      )
      expect(result3.executedRules.length).toBe(1)
      expect(result3.hitRules.length).toBe(0)
      const result4 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-4',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 250,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 3000,
        })
      )
      expect(result4.executedRules.length).toBe(1)
      expect(result4.hitRules.length).toBe(0)
      const result5 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 't-5',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 250,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 4000,
        })
      )
      expect(result5.executedRules.length).toBe(1)
      expect(result5.hitRules.length).toBe(1)
    })
  })

  describe('Simple case -  max and min agg func', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: {
          and: [
            { '>': [{ var: 'agg:test-max' }, 100] },
            { '<': [{ var: 'agg:test-min' }, 150] },
          ],
        },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test-max',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'MAX',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            baseCurrency: 'USD',
            includeCurrentEntity: true,
          },
          {
            key: 'agg:test-min',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:destinationAmountDetails-transactionAmount',
            aggregationFunc: 'MIN',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            baseCurrency: 'USD',
            includeCurrentEntity: true,
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const timestamp = dayjs().valueOf()
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 99,
            transactionCurrency: 'USD',
          },
          destinationAmountDetails: {
            transactionAmount: 200,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp,
        })
      )
      expect(result1.executedRules.length).toBe(1)
      expect(result1.hitRules.length).toBe(0)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 90,
            transactionCurrency: 'USD',
          },
          destinationAmountDetails: {
            transactionAmount: 170,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 1,
        })
      )
      expect(result2.executedRules.length).toBe(1)
      expect(result2.hitRules.length).toBe(0)
      const result3 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-3',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 185,
            transactionCurrency: 'USD',
          },
          destinationAmountDetails: {
            transactionAmount: 160,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 2,
        })
      )
      expect(result3.executedRules.length).toBe(1)
      expect(result3.hitRules.length).toBe(0)
      const result4 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-4',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 101,
            transactionCurrency: 'USD',
          },
          destinationAmountDetails: {
            transactionAmount: 140,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 3,
        })
      )
      expect(result4.executedRules.length).toBe(1)
      expect(result4.hitRules.length).toBe(1)
    })
  })

  describe('Simple case - exclude current entity', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: {
          and: [{ '>': [{ var: 'agg:test-exclude' }, 140] }],
        },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test-exclude',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER_OR_RECEIVER',
            transactionDirection: 'SENDING',
            aggregationFieldKey:
              'TRANSACTION:originAmountDetails-transactionAmount',
            aggregationFunc: 'SUM',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            baseCurrency: 'USD',
            includeCurrentEntity: false,
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const timestamp = dayjs().valueOf()
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp,
        })
      )
      expect(result1.executedRules.length).toBe(1)
      expect(result1.hitRules.length).toBe(0)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 1,
        })
      )
      expect(result2.executedRules.length).toBe(1)
      expect(result2.hitRules.length).toBe(0)
      const result3 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-3',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 2,
        })
      )
      expect(result3.executedRules.length).toBe(1)
      expect(result3.hitRules.length).toBe(0)
      const result4 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-4',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 3,
        })
      )
      expect(result4.executedRules.length).toBe(1)
      expect(result4.hitRules.length).toBe(1)
    })
  })

  describe('with aggregation based on tags - last n aggregation', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: {
          and: [
            {
              '>': [{ var: 'agg:test-agg-last-n-tags' }, 1],
            },
          ],
        },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test-agg-last-n-tags',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:tags',
            aggregationFilterFieldKey: 'key',
            aggregationFilterFieldValue: 'tag-1',
            aggregationFunc: 'UNIQUE_COUNT',
            timeWindow: {
              start: { units: 0, granularity: 'all_time' },
              end: { units: 0, granularity: 'now' },
            },
            includeCurrentEntity: true,
            lastNEntities: 3,
          },
        ],
        type: 'TRANSACTION',
      },
    ])
    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const timestamp = dayjs().valueOf()
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: dayjs().subtract(1, 'year').valueOf(),
          tags: [
            {
              key: 'tag-1',
              value: 'value-1a',
            },
            {
              key: 'tag-2',
              value: 'value-2',
            },
          ],
        })
      )
      expect(result1.executedRules.length).toBe(1)
      expect(result1.hitRules.length).toBe(0)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 1,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1c',
            },
            {
              key: 'tag-2',
              value: 'value-2',
            },
            {
              key: 'tag-3',
              value: 'value-3',
            },
          ],
        })
      )
      expect(result2.executedRules.length).toBe(1)
      expect(result2.hitRules.length).toBe(0)
      const result3 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-3',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 2,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1b',
            },
            {
              key: 'tag-3',
              value: 'value-3',
            },
          ],
        })
      )
      expect(result3.executedRules.length).toBe(1)
      expect(result3.hitRules.length).toBe(1)
      const result4 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-4',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 3,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1b',
            },
            {
              key: 'tag-2',
              value: 'value-2b',
            },
          ],
        })
      )
      expect(result4.executedRules.length).toBe(1)
      expect(result4.hitRules.length).toBe(1)
      const result5 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-5',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 4,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1b',
            },
            {
              key: 'tag-2',
              value: 'value-2b',
            },
          ],
        })
      )
      expect(result5.executedRules.length).toBe(1)
      expect(result5.hitRules.length).toBe(0)
    })
  })
  describe('with aggregation based on tags - time aggregation', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-1',
        defaultLogic: {
          and: [
            {
              some: [
                {
                  var: 'agg:test',
                },
                {
                  in: [
                    {
                      var: '',
                    },
                    ['value-1b', 'value-1c'],
                  ],
                },
              ],
            },
          ],
        },
        defaultLogicAggregationVariables: [
          {
            key: 'agg:test',
            type: 'PAYMENT_DETAILS_TRANSACTIONS',
            userDirection: 'SENDER',
            transactionDirection: 'SENDING',
            aggregationFieldKey: 'TRANSACTION:tags',
            aggregationFilterFieldKey: 'key',
            aggregationFilterFieldValue: 'tag-1',
            aggregationFunc: 'UNIQUE_VALUES',
            timeWindow: {
              start: { units: 1, granularity: 'day' },
              end: { units: 0, granularity: 'day' },
            },
            includeCurrentEntity: true,
          },
        ],
        type: 'TRANSACTION',
      },
    ])
    test('Basic test', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const timestamp = dayjs().valueOf()
      const result1 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-1',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1a',
            },
            {
              key: 'tag-2',
              value: 'value-2',
            },
          ],
        })
      )
      expect(result1.executedRules.length).toBe(1)
      expect(result1.hitRules.length).toBe(0)
      const result2 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-2',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 1,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1a',
            },
            {
              key: 'tag-2',
              value: 'value-2',
            },
            {
              key: 'tag-3',
              value: 'value-3',
            },
          ],
        })
      )
      expect(result2.executedRules.length).toBe(1)
      expect(result2.hitRules.length).toBe(0)
      const result3 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-3',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 2,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1c',
            },
            {
              key: 'tag-3',
              value: 'value-3',
            },
          ],
        })
      )
      expect(result3.executedRules.length).toBe(1)
      expect(result3.hitRules.length).toBe(1)
      const result4 = await rulesEngine.verifyTransaction(
        getTestTransaction({
          transactionId: 'tx-4',
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
          originAmountDetails: {
            transactionAmount: 50,
            transactionCurrency: 'USD',
          },
          timestamp: timestamp + 3,
          tags: [
            {
              key: 'tag-1',
              value: 'value-1b',
            },
            {
              key: 'tag-2',
              value: 'value-2b',
            },
          ],
        })
      )
      expect(result4.executedRules.length).toBe(1)
      expect(result4.hitRules.length).toBe(1)
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
            includeCurrentEntity: true,
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
            includeCurrentEntity: true,
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
            includeCurrentEntity: true,
          },
        ],
        type: 'TRANSACTION',
      },
    ])

    test('', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
            includeCurrentEntity: true,
          },
        ],
      },
    ])
    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({ userId: 'U-1' }),
      getTestUser({ userId: 'U-2' }),
    ])
    test('Sender User matches the filter (hit)', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
  describe("transaction event shouldn't be double counted", () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'RC-V8-R-4',
        defaultLogic: { and: [{ '>=': [{ var: 'agg:test' }, 2] }] },
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
            includeCurrentEntity: true,
          },
        ],
      },
    ])
    setUpUsersHooks(TEST_TENANT_ID, [getTestUser({ userId: 'U-1' })])
    test('', async () => {
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
      const transaction = getTestTransaction({
        originUserId: 'U-1',
      })
      const result1 = await rulesEngine.verifyTransaction(transaction)
      expect(result1.status).toBe('ALLOW')
      const transactionEvent = getTestTransactionEvent({
        transactionId: transaction.transactionId,
        transactionState: 'SUCCESSFUL',
      })
      const result2 = await rulesEngine.verifyTransactionEvent(transactionEvent)
      expect(result2.hitRules).toHaveLength(0)
    })
  })
})

describe('Verify Transaction V8 engine with Update Aggregation', () => {
  withFeatureHook(['RULES_ENGINE_V8'])

  const mock = jest.spyOn(LogicEvaluator.prototype, 'updateAggregationVariable')

  const TEST_TENANT_ID = getTestTenantId()
  const aggregationVariables: LogicAggregationVariable = {
    key: 'agg:test',
    type: 'PAYMENT_DETAILS_TRANSACTIONS',
    transactionDirection: 'SENDING',
    aggregationFieldKey: 'TRANSACTION:transactionId',
    aggregationFunc: 'COUNT',
    timeWindow: {
      start: { units: 1, granularity: 'day' },
      end: { units: 0, granularity: 'day' },
    },
    includeCurrentEntity: true,
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
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )

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
          includeCurrentEntity: true,
        },
      ],
      type: 'TRANSACTION',
    },
  ])

  test('executes the json logic - hit for course grained aggregation', async () => {
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )
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
          includeCurrentEntity: true,
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
          includeCurrentEntity: true,
        },
      ],
      type: 'TRANSACTION',
    },
  ])

  test('executes the json logic - not hit for rolling basis ', async () => {
    /** This Test would fail if we use incorrectly use course grained aggregation(month) for rolling basis,
     *  as it would use complete previous month */

    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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
      const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
      const rulesEngine = new RulesEngineService(
        TEST_TENANT_ID,
        dynamoDb,
        logicEvaluator
      )
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

    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )

    const v8Mock = jest.spyOn(LogicEvaluator.prototype, 'evaluate')

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
          includeCurrentEntity: true,
        },
      ],
      type: 'TRANSACTION',
      status: 'DEPLOYING',
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [getTestUser({ userId: '1' })])

  test('transactions created during Deploying should be put to aggregation data', async () => {
    const logicEvaluator = new LogicEvaluator(TEST_TENANT_ID, dynamoDb)
    const rulesEngine = new RulesEngineService(
      TEST_TENANT_ID,
      dynamoDb,
      logicEvaluator
    )
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

describe('Verify Transction and Transaction Event with V8 Risk scoring', () => {
  withFeatureHook(['RISK_SCORING_V8', 'RISK_SCORING', 'RISK_LEVELS'])
  const tenantId = getTestTenantId()
  const userId1 = uuidv4()
  const userId2 = uuidv4()
  setUpRiskFactorsHook(tenantId, [
    getTestRiskFactor({
      id: 'RF1',
      riskLevelLogic: [
        {
          logic: {
            and: [{ '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] }],
          },
          riskLevel: 'VERY_LOW',
          riskScore: 10,
          weight: 1,
        },
        {
          logic: {
            and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }],
          },
          riskLevel: 'LOW',
          riskScore: 30,
          weight: 1,
        },
        {
          logic: {
            and: [{ '==': [{ var: 'TRANSACTION:type' }, 'REFUND'] }],
          },
          riskLevel: 'MEDIUM',
          riskScore: 50,
          weight: 1,
        },
        {
          logic: {
            and: [{ '==': [{ var: 'TRANSACTION:type' }, 'WITHDRAWAL'] }],
          },
          riskLevel: 'HIGH',
          riskScore: 70,
          weight: 1,
        },
        {
          logic: {
            and: [{ '==': [{ var: 'TRANSACTION:type' }, 'EXTERNAL_PAYMENT'] }],
          },
          riskLevel: 'VERY_HIGH',
          riskScore: 90,
          weight: 1,
        },
      ],
    }),
    getTestRiskFactor({
      id: 'RF2',
      type: 'CONSUMER_USER',
      riskLevelLogic: [
        {
          logic: {
            and: [
              {
                '==': [
                  { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                  'CANCELLED',
                ],
              },
            ],
          },
          riskLevel: 'MEDIUM',
          riskScore: 50,
          weight: 1,
        },
        {
          logic: {
            and: [
              {
                '==': [
                  { var: 'CONSUMER_USER:kycStatusDetails-status__SENDER' },
                  'FAILED',
                ],
              },
            ],
          },
          riskLevel: 'HIGH',
          riskScore: 70,
          weight: 1,
        },
      ],
    }),
    getTestRiskFactor({
      id: 'RF3',
      riskLevelLogic: [
        {
          logic: {
            and: [
              { '==': [{ var: 'TRANSACTION:transactionState' }, 'REFUNDED'] },
            ],
          },
          weight: 1,
          riskLevel: 'LOW',
          riskScore: 30,
        },
        {
          logic: {
            and: [
              { '==': [{ var: 'TRANSACTION:transactionState' }, 'CREATED'] },
            ],
          },
          weight: 1,
          riskLevel: 'VERY_HIGH',
          riskScore: 90,
        },
      ],
    }),
  ])

  it('should match transaction and transaction event', async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const tenantService = new TenantService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    await tenantService.createOrUpdateTenantSettings({
      riskScoringCraEnabled: true,
      riskScoringAlgorithm: {
        type: 'FORMULA_SIMPLE_AVG',
      },
    })

    await createConsumerUser(
      tenantId,
      getTestUser({
        userId: userId1,
        kycStatusDetails: {
          status: 'FAILED',
        },
      }),
      true,
      true
    )
    await createConsumerUser(
      tenantId,
      getTestUser({
        userId: userId2,
        kycStatusDetails: {
          status: 'CANCELLED',
        },
      }),
      true,
      true
    )
    const transaction = getTestTransaction({
      originUserId: userId1,
      destinationUserId: userId2,
      type: 'EXTERNAL_PAYMENT',
      transactionState: 'CREATED',
    })
    const rulesEngine = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )

    const rulesResult = await rulesEngine.verifyTransaction(transaction)
    expect(rulesResult).toEqual({
      transactionId: transaction.transactionId,
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
      riskScoreDetails: {
        trsScore: 90,
        trsRiskLevel: 'VERY_HIGH',
        originUserCraRiskLevel: 'VERY_HIGH',
        destinationUserCraRiskLevel: 'HIGH',
        originUserCraRiskScore: 80,
        destinationUserCraRiskScore: 70,
      },
    })
    const dynamoDbTransactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )

    const transactionResult =
      await dynamoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    expect(transactionResult).toEqual({
      ...transaction,
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
      riskScoreDetails: {
        trsRiskLevel: 'VERY_HIGH',
        trsScore: 90,
      },
    })

    const mongoDbTransactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb
    )

    const mongoTransactionResult =
      await mongoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    expect(mongoTransactionResult).toMatchObject({
      ...transaction,
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
    })

    const transactionEvent = getTestTransactionEvent({
      transactionId: transaction.transactionId,
      transactionState: 'REFUNDED',
      eventDescription: 'Refunded',
      timestamp: Date.now(),
      updatedTransactionAttributes: {
        productType: 'test',
        originPaymentDetails: {
          method: 'ACH',
        },
        destinationAmountDetails: {
          transactionAmount: 1000000,
          transactionCurrency: 'INR',
        },
      },
    })

    const result = await rulesEngine.verifyTransactionEvent(transactionEvent)
    expect(result).toEqual({
      eventId: expect.any(String),
      transaction: expect.objectContaining({
        transactionId: transaction.transactionId,
      }),
      executedRules: [],
      hitRules: [],
      riskScoreDetails: {
        trsScore: 60,
        trsRiskLevel: 'HIGH',
        originUserCraRiskLevel: 'HIGH',
        destinationUserCraRiskLevel: 'MEDIUM',
        originUserCraRiskScore: 65,
        destinationUserCraRiskScore: 55,
      },
    })
    const transactionEventRepository = new TransactionEventRepository(
      tenantId,
      { dynamoDb, mongoDb }
    )

    const transactionEvents =
      await transactionEventRepository.getTransactionEvents(
        transaction.transactionId
      )

    expect(transactionEvents).toMatchObject([
      {
        updatedTransactionAttributes: {
          destinationAmountDetails: {
            country: 'IN',
            transactionCurrency: 'INR',
            transactionAmount: 68351.34,
          },
          originUserId: userId1,
          originAmountDetails: {
            country: 'DE',
            transactionCurrency: 'EUR',
            transactionAmount: 800,
          },
          destinationPaymentDetails: {
            cardIssuedCountry: 'IN',
            '3dsDone': true,
            method: 'CARD',
            transactionReferenceField: 'DEPOSIT',
          },
          transactionState: 'CREATED',
          transactionId: transaction.transactionId,
          destinationUserId: userId2,
          originPaymentDetails: {
            cardIssuedCountry: 'US',
            '3dsDone': true,
            method: 'CARD',
            transactionReferenceField: 'DEPOSIT',
          },
          promotionCodeUsed: true,
          timestamp: expect.any(Number),
        },
        hitRules: [],
        executedRules: [],
        transactionState: 'CREATED',
        transactionId: transaction.transactionId,
        timestamp: expect.any(Number),
      },
      {
        updatedTransactionAttributes: {
          destinationAmountDetails: {
            transactionCurrency: 'INR',
            transactionAmount: 1000000,
          },
          productType: 'test',
          originPaymentDetails: {
            method: 'ACH',
          },
        },
        hitRules: [],
        executedRules: [],
        eventDescription: 'Refunded',
        transactionState: 'REFUNDED',
        transactionId: transaction.transactionId,
        timestamp: expect.any(Number),
      },
    ])

    const mongoTransactionAfterEvent =
      await mongoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    const toMatchObject = {
      originAmountDetails: {
        country: 'DE',
        transactionCurrency: 'EUR',
        transactionAmount: 800,
      },
      destinationPaymentDetails: {
        cardIssuedCountry: 'IN',
        cardFingerprint: expect.any(String),
        '3dsDone': true,
        method: 'CARD',
        transactionReferenceField: 'DEPOSIT',
      },
      transactionId: transaction.transactionId,
      destinationAmountDetails: {
        country: 'IN',
        transactionCurrency: 'INR',
        transactionAmount: 1000000,
      },
      hitRules: [],
      originUserId: userId1,
      executedRules: [],
      transactionState: 'REFUNDED',
      destinationUserId: userId2,
      originPaymentDetails: {
        cardIssuedCountry: 'US',
        cardFingerprint: expect.any(String),
        '3dsDone': true,
        method: 'ACH',
        transactionReferenceField: 'DEPOSIT',
      },
      productType: 'test',
      promotionCodeUsed: true,
      timestamp: expect.any(Number),
      status: 'ALLOW',
      originPaymentMethodId: null,
      destinationPaymentMethodId: expect.any(String),
      createdAt: expect.any(Number),
    }

    expect(mongoTransactionAfterEvent).toMatchObject(toMatchObject)

    const dynamoDbTransactionAfterEvent =
      await dynamoDbTransactionRepository.getTransactionById(
        transaction.transactionId
      )

    delete toMatchObject.createdAt
    delete toMatchObject.destinationPaymentMethodId
    delete (toMatchObject as any).originPaymentMethodId

    expect(dynamoDbTransactionAfterEvent).toMatchObject(toMatchObject)
  })
})
