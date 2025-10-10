import { TransactionTypeRuleFilter } from '../transaction-type'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

filterVariantsTest({ v8: true }, () => {
  test('Transaction type missing', async () => {
    expect(
      await new TransactionTypeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            type: undefined,
          }),
        },
        { transactionTypes: ['DEPOSIT'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction type matches the filter', async () => {
    expect(
      await new TransactionTypeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            type: 'DEPOSIT',
          }),
        },
        { transactionTypes: ['DEPOSIT'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test("Transaction type doesn't the filter", async () => {
    expect(
      await new TransactionTypeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            type: 'DEPOSIT',
          }),
        },
        { transactionTypes: ['REFUND'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })
})
