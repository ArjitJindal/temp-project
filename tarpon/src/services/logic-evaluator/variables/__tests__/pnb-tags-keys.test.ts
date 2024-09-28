import { PNB_TAGS_KEYS, PNB_TAGS_KEYS_VARIABLES } from '../pnb-tags-keys'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Test PNB tags keys', async () => {
  await Promise.all(
    PNB_TAGS_KEYS.map(async (key) => {
      const variable = PNB_TAGS_KEYS_VARIABLES.find(
        (v) => v.key === `tags-${key}`
      )
      if (!variable) {
        throw new Error(`Variable not found for key: ${key}`)
      }
      const transaction = getTestTransaction({
        tags: [{ key, value: 'test' }],
      })
      const value = await variable.load(transaction)
      expect(value).toBe('test')
    })
  )
})
