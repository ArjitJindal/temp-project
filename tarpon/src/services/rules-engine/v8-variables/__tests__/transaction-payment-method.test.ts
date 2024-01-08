import { TRANSACTION_ORIGIN_PAYMENT_METHOD } from '../transaction-payment-method'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Transaction origin payment method', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: {
      method: 'CARD',
    },
  })
  const method = await TRANSACTION_ORIGIN_PAYMENT_METHOD.load(transaction)
  expect(method).toBe('CARD')
})

test('Transaction origin payment method - no payment details', async () => {
  const transaction = getTestTransaction({
    originPaymentDetails: undefined,
  })
  const method = await TRANSACTION_ORIGIN_PAYMENT_METHOD.load(transaction)
  expect(method).toBeUndefined()
})
