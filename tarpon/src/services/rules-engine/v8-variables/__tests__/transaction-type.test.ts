import { TRANSACTION_TYPE } from '../transaction-type'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('gets transaction type from a transaction', async () => {
  const transaction = getTestTransaction({ type: 'DEPOSIT' })
  const type = await TRANSACTION_TYPE.load(transaction)
  expect(type).toBe('DEPOSIT')
})
