import { TransactionCountryRuleFilter } from '../transaction-country'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Transaction country matches the filter', async () => {
  expect(
    await new TransactionCountryRuleFilter(
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
      { transactionCountries: ['IN'] },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction country doesn't match the filter", async () => {
  expect(
    await new TransactionCountryRuleFilter(
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
      { transactionCountries: ['AF'] },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new TransactionCountryRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originAmountDetails: undefined,
          destinationAmountDetails: undefined,
        }),
      },
      { transactionCountries: ['BD'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction country matches the filter', async () => {
  expect(
    await new TransactionCountryRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originAmountDetails: undefined,
          destinationAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'INR',
            country: 'IN',
          },
        }),
      },
      { transactionCountries: ['IN'] },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test("Transaction destination country doesn't match the filter", async () => {
  expect(
    await new TransactionCountryRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originAmountDetails: undefined,
          destinationAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'INR',
            country: 'IN',
          },
        }),
      },
      { transactionCountries: ['CN'] },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new TransactionCountryRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originAmountDetails: undefined,
          destinationAmountDetails: undefined,
        }),
      },
      { transactionCountries: ['CN'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})
