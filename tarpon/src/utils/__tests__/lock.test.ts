import { range } from 'lodash'
import { getDynamoDbClient } from '../dynamodb'
import { acquireLock, releaseLock } from '../lock'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

describe.skip('lock', () => {
  it('acquire/release lock in the correct order: same key', async () => {
    const client = getDynamoDbClient()
    const totalIds = 10
    const ids = range(totalIds)
    const result: number[] = []
    await Promise.all(
      ids.map(async (id) => {
        await acquireLock(client, 'lock-key', {
          startingDelay: 100,
          maxDelay: 100,
          numOfAttempts: 10,
        })
        result.push(id)
        await new Promise((resolve) => setTimeout(resolve, 10))
        await releaseLock(client, 'lock-key')
        result.push(id)
      })
    )
    for (const id of ids) {
      expect(result.lastIndexOf(id) - result.indexOf(id)).toBe(1)
    }
  })
})
