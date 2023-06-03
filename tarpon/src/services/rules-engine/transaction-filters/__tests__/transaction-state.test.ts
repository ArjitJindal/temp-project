import { TransactionStateRuleFilter } from '../transaction-state'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Transaction state missing', async () => {
  expect(
    await new TransactionStateRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          transactionState: undefined,
        }),
      },
      { transactionStates: ['DECLINED'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction state matches the filter', async () => {
  expect(
    await new TransactionStateRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          transactionState: 'DECLINED',
        }),
      },
      { transactionStates: ['DECLINED'] },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Transaction state matches the filter', async () => {
  expect(
    await new TransactionStateRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          transactionState: 'CREATED',
        }),
      },
      { transactionStates: ['DECLINED'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})
