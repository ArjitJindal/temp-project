import { TRANSACTION_PRODUCT_TYPE } from '../transaction-product-types'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Transaction product type', async () => {
  const transaction = getTestTransaction({ productType: 'PRODUCT' })
  const type = await TRANSACTION_PRODUCT_TYPE.load(transaction)
  expect(type).toBe('PRODUCT')
})
