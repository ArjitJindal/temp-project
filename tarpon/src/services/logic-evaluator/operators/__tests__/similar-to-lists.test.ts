import { SIMILAR_TO_LISTS_OPERATOR } from '../similar-to-lists'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListRepository } from '@/services/list/repositories/list-repository'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()
const dynamoDb = getDynamoDbClient()

describe('similar-to-lists', () => {
  let testListId: string

  const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)
  beforeAll(async () => {
    const { listId } = await listRepo.createList('BLACKLIST', 'STRING', {
      items: [
        { key: 'hello' },
        { key: 'world' },
        { key: 'foo' },
        { key: 'bar' },
      ],
    })

    testListId = listId
  })

  test('should return true if the value is similar to any item in the list', async () => {
    const result = await SIMILAR_TO_LISTS_OPERATOR.run(
      'helo',
      testListId,
      [50],
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )

    expect(result).toBe(true)
  })

  test('should return false if the value is not similar to any item in the list', async () => {
    const result = await SIMILAR_TO_LISTS_OPERATOR.run('he', testListId, [50], {
      tenantId: TEST_TENANT_ID,
      dynamoDb,
    })

    expect(result).toBe(false)
  })

  test('Fuzziness 99 should return false', async () => {
    const result = await SIMILAR_TO_LISTS_OPERATOR.run(
      'helo',
      testListId,
      [99],
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )

    expect(result).toBe(true)
  })

  test('Fuzziness 100 should return true', async () => {
    const result = await SIMILAR_TO_LISTS_OPERATOR.run(
      'hello',
      testListId,
      [100],
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )

    expect(result).toBe(true)
  })
})
