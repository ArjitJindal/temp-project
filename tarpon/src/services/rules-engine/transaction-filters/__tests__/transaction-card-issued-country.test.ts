import { TransactionCardIssuedCountry } from '../transaction-card-issued-country'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamoDb = getDynamoDbClient()

test('Transaction card issued country matches the filter', async () => {
  expect(
    await new TransactionCardIssuedCountry(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'INR',
            country: 'IN',
          },
          originPaymentDetails: {
            method: 'CARD',
            cardIssuedCountry: 'IN',
          },
          destinationAmountDetails: undefined,
        }),
      },
      { transactionCardIssuedCountries: ['IN'] },
      dynamoDb
    ).predicate()
  ).toBe(true)
})

test('Transaction card issued country does not match the filter', async () => {
  expect(
    await new TransactionCardIssuedCountry(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'INR',
            country: 'IN',
          },
          originPaymentDetails: {
            method: 'CARD',
            cardIssuedCountry: 'US',
          },
          destinationAmountDetails: undefined,
        }),
      },
      { transactionCardIssuedCountries: ['IN'] },
      dynamoDb
    ).predicate()
  ).toBe(false)
})

test('Transaction card issued country is not present in the transaction', async () => {
  expect(
    await new TransactionCardIssuedCountry(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'INR',
            country: 'IN',
          },
          originPaymentDetails: {
            method: 'CARD',
          },
          destinationPaymentDetails: {
            method: 'CARD',
          },
        }),
      },
      { transactionCardIssuedCountries: ['IN'] },
      dynamoDb
    ).predicate()
  ).toBe(false)
})
