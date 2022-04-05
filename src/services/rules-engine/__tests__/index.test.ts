import { verifyTransaction } from '..'
import { TransactionRepository } from '../repositories/transaction-repository'
import { getTestDynamoDb } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { createRule } from '@/test-utils/rule-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'

const TEST_TENANT_ID = getTestTenantId()
const dynamoDb = getTestDynamoDb()

function setUpRules(ruleImplementationFilenames: string[]) {
  const cleanups: Array<() => void> = [
    async () => {
      return
    },
  ]

  beforeAll(async () => {
    for (const ruleImplementationFilename of ruleImplementationFilenames) {
      cleanups.push(
        await createRule(TEST_TENANT_ID, {
          name: 'test rule name',
          description: 'test rule description',
          parametersSchema: {},
          defaultParameters: {},
          defaultAction: 'FLAG',
          ruleImplementationFilename,
        })
      )
    }
  })
  afterAll(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
  })
}

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
  setUpRules(['tests/test-success-rule'])

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
  setUpRules(['tests/test-failure-rule'])

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
  setUpRules(['tests/test-ghost-rule'])

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
  setUpRules(['tests/test-success-rule', 'tests/test-failure-rule'])

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
