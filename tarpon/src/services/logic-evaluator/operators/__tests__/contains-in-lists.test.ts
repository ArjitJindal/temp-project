import { CONTAINS_IN_LISTS_OPERATOR } from '../contains-in-lists'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListRepository } from '@/services/list/repositories/list-repository'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()
const dynamoDb = getDynamoDbClient()

describe('contains in lists operator', () => {
  let testListId1: string

  const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)
  beforeEach(async () => {
    const { listId: listId1 } = await listRepo.createList(
      'BLACKLIST',
      'STRING',
      {
        items: [{ key: 'string_1' }, { key: 'string_2' }],
        metadata: { status: true },
      }
    )
    testListId1 = listId1
  })

  test('should return true if partial match in the lists', async () => {
    const result = await CONTAINS_IN_LISTS_OPERATOR.run(
      'string',
      [testListId1],
      undefined,
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )
    expect(result).toBe(true)
  })

  test('should return true if partial match in the lists', async () => {
    const result = await CONTAINS_IN_LISTS_OPERATOR.run(
      '_1',
      [testListId1],
      undefined,
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )
    expect(result).toBe(true)
  })

  test('should return false if no match in the lists', async () => {
    const result = await CONTAINS_IN_LISTS_OPERATOR.run(
      'str_1',
      [testListId1],
      undefined,
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )
    expect(result).toBe(false)
  })
})
