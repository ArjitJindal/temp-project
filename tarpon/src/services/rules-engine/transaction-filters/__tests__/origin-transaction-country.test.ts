import { OriginTransactionCountryRuleFilter } from '../origin-transaction-country'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

filterVariantsTest({ v8: true }, () => {
  test('Transaction country matches the filter', async () => {
    expect(
      await new OriginTransactionCountryRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'INR',
              country: 'IN',
            },
            destinationAmountDetails: undefined,
          }),
        },
        { originTransactionCountries: ['IN'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test("Transaction country doesn't match the filter", async () => {
    expect(
      await new OriginTransactionCountryRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'INR',
              country: 'IN',
            },
            destinationAmountDetails: undefined,
          }),
        },
        { originTransactionCountries: ['AF'] },
        dynamodb
      ).predicate()
    ).toBe(false)
    expect(
      await new OriginTransactionCountryRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originAmountDetails: undefined,
            destinationAmountDetails: undefined,
          }),
        },
        { originTransactionCountries: ['BD'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction country matches the filter', async () => {
    expect(
      await new OriginTransactionCountryRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'INR',
              country: 'IN',
            },
            destinationAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'INR',
              country: 'US',
            },
          }),
        },
        { originTransactionCountries: ['IN'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
})
