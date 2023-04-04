import _ from 'lodash'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@cdk/constants'
import { RulesEngineService } from '..'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import { RiskRepository } from '../../risk-scoring/repositories/risk-repository'
import { RuleInstanceRepository } from '../repositories/rule-instance-repository'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { getTestTransactionEvent } from '@/test-utils/transaction-event-test-utils'
import { getContextStorage } from '@/core/utils/context'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongoDBUtils'

const RULE_INSTANCE_ID_MATCHER = expect.stringMatching(/^([a-z0-9]){8}$/)

const dynamoDb = getDynamoDbClient()

dynamoDbSetupHook()

describe('Verify Transaction', () => {
  test('Verify Transaction: returns empty executed rules if no rules are configured', async () => {
    const rulesEngine = new RulesEngineService(getTestTenantId(), dynamoDb)
    const transaction = getTestTransaction({ transactionId: 'dummy' })
    const result = await rulesEngine.verifyTransaction(transaction)
    expect(result).toEqual({
      transactionId: 'dummy',
      executedRules: [],
      hitRules: [],
    })
  })

  describe('Verify Transaction: executed rules', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-1',
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
            ruleId: 'R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: 'test rule description.',
            ruleAction: 'FLAG',
            ruleHit: true,
            nature: 'AML',
            labels: [],
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
        hitRules: [
          {
            ruleId: 'R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: 'test rule description.',
            ruleAction: 'FLAG',
            nature: 'AML',
            labels: [],
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
        id: 'R-1',
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
        ruleId: 'R-1',
        ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
        ruleName: 'test rule name',
        ruleDescription: 'test rule description.',
        ruleAction: 'FLAG',
        nature: 'AML',
        labels: [],
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
        hitRules: [expectedRuleResult],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction: executed rules (non-hit)', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-1',
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
            ruleId: 'R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: 'test rule description.',
            ruleAction: 'FLAG',
            ruleHit: false,
            nature: 'AML',
            labels: [],
          },
        ],
        hitRules: [],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction: skip already verified transaction', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-1',
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
        id: 'R-1',
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
            ruleId: 'R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: 'test rule description.',
            ruleAction: 'FLAG',
            ruleHit: true,
            nature: 'AML',
            labels: [],
            ruleHitMeta: {
              hitDirections: ['DESTINATION'],
            },
          },
        ],
        hitRules: [
          {
            ruleId: 'R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: 'test rule description.',
            ruleAction: 'FLAG',
            nature: 'AML',
            labels: [],
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
        id: 'R-1',
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
        deviceData: {
          deviceIdentifier: 'deviceIdentifier',
        },
      })
      const result1 = await rulesEngine.verifyTransaction(transaction)

      expect(
        (
          await transactionRepository.getTransactionById(
            transaction.transactionId as string
          )
        )?.deviceData
      ).toEqual({
        deviceIdentifier: 'deviceIdentifier',
      })

      const transactionEvent = getTestTransactionEvent({
        eventId: '1',
        transactionId: transaction.transactionId,
        transactionState: 'SUCCESSFUL',
        updatedTransactionAttributes: {
          deviceData: {
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
        transaction: _.omit(latestTransaction, ['executedRules', 'hitRules']),
        executedRules: result1.executedRules,
        hitRules: result1.hitRules,
      })
      expect(latestTransaction?.deviceData).toEqual({
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
        transaction: _.omit(latestTransaction, ['executedRules', 'hitRules']),
        executedRules: result1.executedRules,
        hitRules: result1.hitRules,
      })
    })
  })

  describe('Verify Transaction: risk-level parameters', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-1',
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
      await getContextStorage().run({ features: ['PULSE'] }, async () => {
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
              ruleId: 'R-1',
              ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
              ruleName: 'test rule name',
              ruleDescription: 'test rule description.',
              ruleAction: 'BLOCK',
              ruleHit: true,
              nature: 'AML',
              labels: [],
              ruleHitMeta: {
                hitDirections: ['ORIGIN', 'DESTINATION'],
              },
            },
          ],
          hitRules: [
            {
              ruleId: 'R-1',
              ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
              ruleName: 'test rule name',
              ruleDescription: 'test rule description.',
              ruleAction: 'BLOCK',
              nature: 'AML',
              labels: [],
              ruleHitMeta: {
                hitDirections: ['ORIGIN', 'DESTINATION'],
              },
            },
          ],
        } as TransactionMonitoringResult)
      })
    })

    test('returns normal action without PULSE feature flag', async () => {
      const rulesEngine = new RulesEngineService(TEST_TENANT_ID, dynamoDb)
      const transaction = getTestTransaction({ transactionId: '2' })
      const result = await rulesEngine.verifyTransaction(transaction)
      expect(result).toEqual({
        transactionId: '2',
        executedRules: [
          {
            ruleId: 'R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: 'test rule description.',
            ruleAction: 'FLAG',
            ruleHit: true,
            nature: 'AML',
            labels: [],
            ruleHitMeta: {
              hitDirections: ['ORIGIN', 'DESTINATION'],
            },
          },
        ],
        hitRules: [
          {
            ruleId: 'R-1',
            ruleInstanceId: RULE_INSTANCE_ID_MATCHER,
            ruleName: 'test rule name',
            ruleDescription: 'test rule description.',
            ruleAction: 'FLAG',
            labels: [],
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
      id: 'R-1',
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
        ruleId: 'R-1',
        casePriority: 'P1',
        parameters: {},
        action: 'BLOCK',
        type: 'TRANSACTION',
        nature: 'AML',
        labels: [],
      }
    )
    expect(result).toEqual({
      ruleId: 'R-1',
      ruleInstanceId: testRuleInstanceId,
      ruleName: 'test rule name',
      ruleDescription: 'test rule description.',
      ruleAction: 'BLOCK',
      ruleHit: true,
      labels: [],
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
})
