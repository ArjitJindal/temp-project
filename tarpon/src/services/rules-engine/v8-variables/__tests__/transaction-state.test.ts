import { TRANSACTION_STATE } from '../transaction-state'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('gets transaction state from a transaction', async () => {
  const transaction = getTestTransaction({ transactionState: 'CREATED' })
  const state = await TRANSACTION_STATE.load(transaction)
  expect(state).toBe('CREATED')
})
