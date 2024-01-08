import {
  TRANSACTION_DESTINATION_PAYMENT_CHANNEL,
  TRANSACTION_ORIGIN_PAYMENT_CHANNEL,
} from '../transaction-payment-channels'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Transaction card issued country', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: {
      method: 'CARD',
      cardIssuedCountry: 'GB',
      paymentChannel: 'ECOMMERCE',
    },
  })
  const paymentChannel = await TRANSACTION_ORIGIN_PAYMENT_CHANNEL.load(
    transaction
  )
  expect(paymentChannel).toBe('ECOMMERCE')
})

test('Transaction card issued country - no card', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: {
      method: 'GENERIC_BANK_ACCOUNT',
    },
  })

  const paymentChannel = await TRANSACTION_ORIGIN_PAYMENT_CHANNEL.load(
    transaction
  )
  expect(paymentChannel).toBeUndefined()
})

test('Transaction card issued country - no origin payment details', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: undefined,
  })

  const paymentChannel = await TRANSACTION_ORIGIN_PAYMENT_CHANNEL.load(
    transaction
  )
  expect(paymentChannel).toBeUndefined()
})

test('Transaction card issued country - destination', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: {
      method: 'CARD',
      cardIssuedCountry: 'GB',
      paymentChannel: 'ECOMMERCE',
    },
  })

  const paymentChannel = await TRANSACTION_DESTINATION_PAYMENT_CHANNEL.load(
    transaction
  )
  expect(paymentChannel).toBe('ECOMMERCE')
})

test('Transaction card issued country - destination - no card', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: {
      method: 'GENERIC_BANK_ACCOUNT',
    },
  })

  const paymentChannel = await TRANSACTION_DESTINATION_PAYMENT_CHANNEL.load(
    transaction
  )
  expect(paymentChannel).toBeUndefined()
})

test('Transaction card issued country - destination - no destination payment details', async () => {
  const transaction = getTestTransaction({
    destinationPaymentDetails: undefined,
  })

  const paymentChannel = await TRANSACTION_DESTINATION_PAYMENT_CHANNEL.load(
    transaction
  )
  expect(paymentChannel).toBeUndefined()
})
