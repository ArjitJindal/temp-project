import { CONTAINS_IN_LISTS_SUBTYPE_OPERATOR } from '../contains-in-lists-subtype'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListRepository } from '@/services/list/repositories/list-repository'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()
const dynamoDb = getDynamoDbClient()

describe('contains in lists operator', () => {
  let testListId1: string
  let testListId2: string

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
    const { listId: listId2 } = await listRepo.createList(
      'BLACKLIST',
      'USER_ID',
      {
        items: [{ key: 'user_1' }, { key: 'user_2' }],
        metadata: { status: true },
      }
    )
    testListId2 = listId2
  })

  test('should return true if partial match in the lists', async () => {
    const result = await CONTAINS_IN_LISTS_SUBTYPE_OPERATOR.run(
      'user_1',
      [testListId2],
      { subtype: 'USER_ID' },
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )
    expect(result).toBe(true)
  })

  test('should return true if partial match in the lists', async () => {
    const result = await CONTAINS_IN_LISTS_SUBTYPE_OPERATOR.run(
      'string_1string',
      [testListId1],
      { subtype: 'STRING' },
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )
    expect(result).toBe(true)
  })

  test('should return false if no match in the lists', async () => {
    const result = await CONTAINS_IN_LISTS_SUBTYPE_OPERATOR.run(
      'str_1',
      [testListId1],
      { subtype: 'STRING' },
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )
    expect(result).toBe(false)
  })

  test('should return true for second element in the list', async () => {
    const result = await CONTAINS_IN_LISTS_SUBTYPE_OPERATOR.run(
      'string_2',
      [testListId1],
      { subtype: 'STRING' },
      { tenantId: TEST_TENANT_ID, dynamoDb }
    )
    expect(result).toBe(true)
  })
})
