import {
  TRANSACTION_ORIGIN_CARD_ISSUED_COUNTRIES,
  TRANSACTION_DESTINATION_CARD_ISSUED_COUNTRIES,
} from '../transaction-card-issued-countries'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Transaction card issued country', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: {
      method: 'CARD',
      cardIssuedCountry: 'GB',
    },
  })
  const country = await TRANSACTION_ORIGIN_CARD_ISSUED_COUNTRIES.load(
    transaction
  )
  expect(country).toBe('GB')
})

test('Transaction card issued country - no card', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: {
      method: 'GENERIC_BANK_ACCOUNT',
    },
  })
  const country = await TRANSACTION_ORIGIN_CARD_ISSUED_COUNTRIES.load(
    transaction
  )
  expect(country).toBeUndefined()
})

test('Transaction card issued country - no origin payment details', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: undefined,
  })
  const country = await TRANSACTION_ORIGIN_CARD_ISSUED_COUNTRIES.load(
    transaction
  )
  expect(country).toBeUndefined()
})

test('Transaction card issued country - destination', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: {
      method: 'CARD',
      cardIssuedCountry: 'GB',
    },
  })
  const country = await TRANSACTION_DESTINATION_CARD_ISSUED_COUNTRIES.load(
    transaction
  )
  expect(country).toBe('GB')
})

test('Transaction card issued country - destination - no card', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: {
      method: 'GENERIC_BANK_ACCOUNT',
    },
  })
  const country = await TRANSACTION_DESTINATION_CARD_ISSUED_COUNTRIES.load(
    transaction
  )
  expect(country).toBeUndefined()
})

test('Transaction card issued country - destination - no destination payment details', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: undefined,
  })
  const country = await TRANSACTION_DESTINATION_CARD_ISSUED_COUNTRIES.load(
    transaction
  )
  expect(country).toBeUndefined()
})
