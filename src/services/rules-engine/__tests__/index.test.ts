import { verifyTransaction, verifyTransactionEvent } from '..'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  dynamoDbSetupHook,
  getTestDynamoDbClient,
} from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { getTestTransactionEvent } from '@/test-utils/transaction-event-test-utils'

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
      failedRules: [],
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
        failedRules: [],
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
        failedRules: [],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction: failed rules', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-1',
        ruleImplementationName: 'tests/test-failure-rule',
        type: 'TRANSACTION',
      },
    ])

    test('returns failed rules', async () => {
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [],
        failedRules: [
          {
            ruleId: 'R-1',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            failureException: {
              exceptionName: 'NO_DATA',
              exceptionDescription: 'Failed when executing the rule',
            },
          },
        ],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction: non-existent rules', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-1',
        ruleImplementationName: 'tests/test-ghost-rule',
        type: 'TRANSACTION',
      },
    ])

    test('returns failed rules', async () => {
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const result = await verifyTransaction(
        transaction,
        TEST_TENANT_ID,
        dynamoDb
      )
      expect(result).toEqual({
        transactionId: 'dummy',
        executedRules: [],
        failedRules: [
          {
            ruleId: 'R-1',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            failureException: {
              exceptionName: 'Unknown',
              exceptionDescription: 'Unknown',
            },
          },
        ],
      } as TransactionMonitoringResult)
    })
  })

  describe('Verify Transaction: executed and failed rules', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-1',
        ruleImplementationName: 'tests/test-success-rule',
        type: 'TRANSACTION',
      },
      {
        id: 'R-2',
        ruleImplementationName: 'tests/test-failure-rule',
        type: 'TRANSACTION',
      },
    ])

    test('returns both executed and failed rules and the transaction is persisted', async () => {
      const transaction = getTestTransaction({ transactionId: 'dummy' })
      const transactionRepository = new TransactionRepository(TEST_TENANT_ID, {
        dynamoDb,
      })
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
        failedRules: [
          {
            ruleId: 'R-2',
            ruleName: 'test rule name',
            ruleDescription: 'test rule description',
            failureException: {
              exceptionName: 'NO_DATA',
              exceptionDescription: 'Failed when executing the rule',
            },
          },
        ],
      } as TransactionMonitoringResult)
      expect(
        await transactionRepository.getTransactionById('dummy')
      ).toMatchObject(transaction)
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
      expect(result1).toEqual(result2)
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
        transactionId: transaction.transactionId,
        transactionState: 'SUCCESSFUL',
        updatedTransactionAttributes: { reference: 'new reference' },
      })
      const result2 = await verifyTransactionEvent(
        transactionEvent,
        TEST_TENANT_ID,
        dynamoDb
      )
      expect(result1).toEqual(result2)
      expect(
        (
          await transactionRepository.getTransactionById(
            transaction.transactionId as string
          )
        )?.reference
      ).toEqual('new reference')
    })
  })
})
