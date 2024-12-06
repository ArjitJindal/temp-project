import {
  FIRST_DIGITAL_CUSTOM_TAGS_KEYS_VARIABLES,
  FIRST_DIGITAL_TAG_KEYS,
  PNB_CUSTOM_TAGS_KEYS,
  PNB_CUSTOM_TAGS_KEYS_VARIABLES,
} from '../custom-tag-keys'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

test('Test PNB tags keys', async () => {
  await Promise.all(
    PNB_CUSTOM_TAGS_KEYS.map(async (key) => {
      const variable = PNB_CUSTOM_TAGS_KEYS_VARIABLES.find(
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

test('Test First Digital tags keys', async () => {
  await Promise.all(
    FIRST_DIGITAL_TAG_KEYS.map(async (key) => {
      const variable = FIRST_DIGITAL_CUSTOM_TAGS_KEYS_VARIABLES.find(
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
