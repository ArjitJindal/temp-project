import {
  TRANSACTION_DESTINATION_WALLET_TYPE,
  TRANSACTION_ORIGIN_WALLET_TYPE,
} from '../transaction-wallet-type'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Transaction wallet type', async () => {
  const transaction = getTestTransaction({
    type: 'DEPOSIT',
    originPaymentDetails: { method: 'WALLET', walletType: 'CREDIT' },
  })
  const type = await TRANSACTION_ORIGIN_WALLET_TYPE.load(transaction)

  expect(type).toBe('CREDIT')
})

test('Transaction wallet type - no wallet', async () => {
  const transaction = getTestTransaction({
    type: 'DEPOSIT',
    originPaymentDetails: { method: 'CARD' },
  })
  const type = await TRANSACTION_ORIGIN_WALLET_TYPE.load(transaction)

  expect(type).toBeUndefined()
})

test('Transaction wallet type - no origin payment details', async () => {
  const transaction = getTestTransaction({
    type: 'DEPOSIT',
    originPaymentDetails: undefined,
  })
  const type = await TRANSACTION_ORIGIN_WALLET_TYPE.load(transaction)

  expect(type).toBeUndefined()
})

test('Transaction wallet type - destination', async () => {
  const transaction = getTestTransaction({
    type: 'DEPOSIT',
    destinationPaymentDetails: { method: 'WALLET', walletType: 'CREDIT' },
  })
  const type = await TRANSACTION_DESTINATION_WALLET_TYPE.load(transaction)

  expect(type).toBe('CREDIT')
})

test('Transaction wallet type - destination - no wallet', async () => {
  const transaction = getTestTransaction({
    type: 'DEPOSIT',
    destinationPaymentDetails: { method: 'CARD' },
  })
  const type = await TRANSACTION_DESTINATION_WALLET_TYPE.load(transaction)

  expect(type).toBeUndefined()
})

test('Transaction wallet type - destination - no destination payment details', async () => {
  const transaction = getTestTransaction({
    type: 'DEPOSIT',
    destinationPaymentDetails: undefined,
  })
  const type = await TRANSACTION_DESTINATION_WALLET_TYPE.load(transaction)

  expect(type).toBeUndefined()
})
