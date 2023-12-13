import { evaluate } from '..'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('executes the json logic - hit', async () => {
  const result = await evaluate(
    { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
    { transaction: getTestTransaction({ type: 'TRANSFER' }) }
  )
  expect(result).toEqual({
    hit: true,
    varData: { 'TRANSACTION:type': 'TRANSFER' },
  })
})

test('executes the json logic - no hit', async () => {
  const result = await evaluate(
    { and: [{ '==': [{ var: 'TRANSACTION:type' }, 'TRANSFER'] }] },
    { transaction: getTestTransaction({ type: 'DEPOSIT' }) }
  )
  expect(result).toEqual({
    hit: false,
    varData: { 'TRANSACTION:type': 'DEPOSIT' },
  })
})
