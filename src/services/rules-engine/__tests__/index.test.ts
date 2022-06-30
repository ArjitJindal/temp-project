import _ from 'lodash'
import { verifyTransaction, verifyTransactionEvent } from '..'
import { TransactionRepository } from '../repositories/transaction-repository'
import { RiskRepository } from '../repositories/risk-repository'
import {
  dynamoDbSetupHook,
  getTestDynamoDbClient,
} from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { getTestTransactionEvent } from '@/test-utils/transaction-event-test-utils'
import { getContextStorage } from '@/core/utils/context'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

const dynamoDb = getTestDynamoDbClient()

dynamoDbSetupHook()

describe('Verify Transaction', () => {
  test('Verify Transaction: returns empty executed rules if no rules are configured', async () => {
    const transaction = getTestTransaction({ transactionId: 'dummy' })
    const result = await verifyTransaction(
      transaction,
      getTestTenantId(),
      dynamoDb
    )
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
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [
          {
            ruleId: 'R-1',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            ruleAction: 'FLAG',
            ruleHit: true,
          },
        ],
        hitRules: [
          {
            ruleId: 'R-1',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            ruleAction: 'FLAG',
          },
        ],
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
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [
          {
            ruleId: 'R-1',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            ruleAction: 'FLAG',
            ruleHit: false,
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
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result1 = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )
      const result2 = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )
      expect(result1.executedRules).toEqual(result2.executedRules)
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
      const transactionRepository = new TransactionRepository(TEST_TENANT_ID, {
        dynamoDb,
      })
      const transaction = getTestTransaction({
        transactionId: 'dummy',
        reference: 'old reference',
      })
      const result1 = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )

      expect(
        (
          await transactionRepository.getTransactionById(
            transaction.transactionId as string
          )
        )?.reference
      ).toEqual('old reference')

      const transactionEvent = getTestTransactionEvent({
        eventId: '1',
        transactionId: transaction.transactionId,
        transactionState: 'SUCCESSFUL',
        updatedTransactionAttributes: { reference: 'new reference' },
      })
      const result2 = await verifyTransactionEvent(
        transactionEvent,
        TEST_TENANT_ID,
        dynamoDb
      )
      const latestTransaction = await transactionRepository.getTransactionById(
        transaction.transactionId as string
      )
      expect(result2).toEqual({
        eventId: transactionEvent.eventId,
        transaction: _.omit(latestTransaction, ['executedRules', 'hitRules']),
        executedRules: result1.executedRules,
        hitRules: result1.hitRules,
      })
      expect(latestTransaction?.reference).toEqual('new reference')
    })

    test("run rules even if the transaction doesn't have updates", async () => {
      const transactionRepository = new TransactionRepository(TEST_TENANT_ID, {
        dynamoDb,
      })
      const transaction = getTestTransaction({
        transactionId: 'dummy-2',
      })
      const result1 = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )

      const transactionEvent = getTestTransactionEvent({
        eventId: '2',
        transactionId: transaction.transactionId,
        transactionState: 'SUCCESSFUL',
        updatedTransactionAttributes: undefined,
      })
      const result2 = await verifyTransactionEvent(
        transactionEvent,
        TEST_TENANT_ID,
        dynamoDb
      )
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
    setUpConsumerUsersHooks(TEST_TENANT_ID, [getTestUser({ userId: '1' })])

    test('returns risk-level action with PULSE feature flag', async () => {
      await getContextStorage().run({ features: ['PULSE'] }, async () => {
        const riskRepository = new RiskRepository(TEST_TENANT_ID, {
          dynamoDb,
        })
        await riskRepository.createOrUpdateManualDRSRiskItem('1', 'HIGH')

        const transaction = getTestTransaction({
          transactionId: '1',
          originUserId: '1',
        })
        const result = await verifyTransaction(
          transaction,
          TEST_TENANT_ID,
          dynamoDb
        )
        expect(result).toEqual({
          transactionId: '1',
          executedRules: [
            {
              ruleId: 'R-1',
              ruleName: 'test rule name',
              ruleDescription: 'test rule description',
              ruleAction: 'BLOCK',
              ruleHit: true,
            },
          ],
          hitRules: [
            {
              ruleId: 'R-1',
              ruleName: 'test rule name',
              ruleDescription: 'test rule description',
              ruleAction: 'BLOCK',
            },
          ],
        } as TransactionMonitoringResult)
      })
    })

    test('returns normal action without PULSE feature flag', async () => {
      const transaction = getTestTransaction({ transactionId: '2' })
      const result = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )
      expect(result).toEqual({
        transactionId: '2',
        executedRules: [
          {
            ruleId: 'R-1',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            ruleAction: 'FLAG',
            ruleHit: true,
          },
        ],
        hitRules: [
          {
            ruleId: 'R-1',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            ruleAction: 'FLAG',
          },
        ],
      } as TransactionMonitoringResult)
    })
  })
})
