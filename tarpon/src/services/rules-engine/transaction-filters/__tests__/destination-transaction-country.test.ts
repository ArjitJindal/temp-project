import { DestinationTransactionCountryRuleFilter } from '../destination-transaction-country'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

filterVariantsTest({ v8: true }, () => {
  test('Transaction destination country matches the filter', async () => {
    expect(
      await new DestinationTransactionCountryRuleFilter(
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
        { destinationTransactionCountries: ['US'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test("Transaction destination country doesn't match the filter", async () => {
    expect(
      await new DestinationTransactionCountryRuleFilter(
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
        { destinationTransactionCountries: ['IN'] },
        dynamodb
      ).predicate()
    ).toBe(false)
    expect(
      await new DestinationTransactionCountryRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            originAmountDetails: undefined,
            destinationAmountDetails: undefined,
          }),
        },
        { destinationTransactionCountries: ['BD'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction destination country matches one of the filters', async () => {
    expect(
      await new DestinationTransactionCountryRuleFilter(
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
        { destinationTransactionCountries: ['US', 'CA'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test("Transaction destination country doesn't match any of the filters", async () => {
    expect(
      await new DestinationTransactionCountryRuleFilter(
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
        { destinationTransactionCountries: ['CA', 'MX'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction has no destination amount details', async () => {
    expect(
      await new DestinationTransactionCountryRuleFilter(
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
        { destinationTransactionCountries: ['US'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })
})
