import {
  TRANSACTION_DESTINATION_COUNTRY,
  TRANSACTION_ORIGIN_COUNTRY,
} from '../transaction-country'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('gets transaction origin country from a transaction', async () => {
  const transaction = getTestTransaction({
    originAmountDetails: {
      transactionAmount: 100,
      transactionCurrency: 'USD',
      country: 'US',
    },
  })
  const country = await TRANSACTION_ORIGIN_COUNTRY.load(transaction)
  expect(country).toBe('US')
})

test('gets transaction destination country from a transaction', async () => {
  const transaction = getTestTransaction({
    destinationAmountDetails: {
      transactionAmount: 100,
      transactionCurrency: 'USD',
      country: 'AD',
    },
  })
  const country = await TRANSACTION_DESTINATION_COUNTRY.load(transaction)
  expect(country).toBe('AD')
})
