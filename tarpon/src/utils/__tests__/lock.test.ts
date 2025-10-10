import range from 'lodash/range'
import { getDynamoDbClient } from '../dynamodb'
import { acquireLock, releaseLock } from '../lock'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

describe.skip('lock', () => {
  it('acquire/release lock in the correct order: same key', async () => {
    const client = getDynamoDbClient()
    const totalIds = 10
    const ids = range(totalIds)
    const acquiredOrder: number[] = []
    const releasedOrder: number[] = []
    await Promise.all(
      ids.map(async (id) => {
        await acquireLock(client, 'lock-key', {
          startingDelay: 200,
          maxDelay: 500,
          numOfAttempts: 20,
        })
        acquiredOrder.push(id)
        await new Promise((resolve) => setTimeout(resolve, 20))
        await releaseLock(client, 'lock-key')
        releasedOrder.push(id)
      })
    )
    for (const id of ids) {
      expect(acquiredOrder[id]).toBe(releasedOrder[id])
    }
  })
})
