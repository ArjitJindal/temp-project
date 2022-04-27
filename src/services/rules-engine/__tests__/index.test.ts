import { verifyTransaction } from '..'
import { TransactionRepository } from '../repositories/transaction-repository'
import {
  dynamoDbSetupHook,
  getTestDynamoDbClient,
} from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { setUpRulesHooks } from '@/test-utils/rule-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'

const TEST_TENANT_ID = getTestTenantId()
const dynamoDb = getTestDynamoDbClient()

dynamoDbSetupHook()

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

describe('Verify Transaction: failed rules', () => {
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
