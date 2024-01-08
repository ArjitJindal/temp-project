import {
  TRANSACTION_DESTINATION_MCC_CODES,
  TRANSACTION_ORIGIN_MCC_CODES,
} from '../transaction-mcc-codes'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Transaction mcc code origin', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: {
      method: 'CARD',
      merchantDetails: {
        MCC: '1234',
      },
    },
  })
  const mcc = await TRANSACTION_ORIGIN_MCC_CODES.load(transaction)

  expect(mcc).toBe('1234')
})

test('Transaction mcc code origin - no card', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: {
      method: 'GENERIC_BANK_ACCOUNT',
    },
  })
  const mcc = await TRANSACTION_ORIGIN_MCC_CODES.load(transaction)

  expect(mcc).toBeUndefined()
})

test('Transaction mcc code origin - no origin payment details', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: undefined,
  })
  const mcc = await TRANSACTION_ORIGIN_MCC_CODES.load(transaction)

  expect(mcc).toBeUndefined()
})

test('Transaction mcc code destination', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: {
      method: 'CARD',
      merchantDetails: {
        MCC: '1234',
      },
    },
  })
  const mcc = await TRANSACTION_DESTINATION_MCC_CODES.load(transaction)

  expect(mcc).toBe('1234')
})

test('Transaction mcc code destination - no card', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: {
      method: 'GENERIC_BANK_ACCOUNT',
    },
  })
  const mcc = await TRANSACTION_DESTINATION_MCC_CODES.load(transaction)

  expect(mcc).toBeUndefined()
})

test('Transaction mcc code destination - no destination payment details', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: undefined,
  })
  const mcc = await TRANSACTION_DESTINATION_MCC_CODES.load(transaction)

  expect(mcc).toBeUndefined()
})
