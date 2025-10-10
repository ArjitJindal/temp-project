import { MATCH_LIST_OPERATOR } from '../match-list'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

dynamoDbSetupHook()

const dynamoDb = getDynamoDbClient()
const TEST_TENANT_ID = getTestTenantId()

describe('match list operator', () => {
  let testListId1: string
  let testListId2: string
  let testInactiveListId: string

  beforeAll(async () => {
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)
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
      'STRING',
      {
        items: [{ key: 'string_3' }, { key: 'string_4' }],
        metadata: { status: true },
      }
    )
    testListId2 = listId2
    const { listId: listId3 } = await listRepo.createList(
      'BLACKLIST',
      'STRING',
      {
        items: [{ key: 'string_1' }],
        metadata: { status: false },
      }
    )
    testInactiveListId = listId3
  })

  test('match single list - true', async () => {
    const result = await MATCH_LIST_OPERATOR.run(
      'string_1',
      [testListId1],
      undefined,
      {
        tenantId: TEST_TENANT_ID,
        dynamoDb,
      }
    )
    expect(result).toBe(true)
  })
  test('match single list - false', async () => {
    const result = await MATCH_LIST_OPERATOR.run(
      'string_x',
      [testListId1],
      undefined,
      {
        tenantId: TEST_TENANT_ID,
        dynamoDb,
      }
    )
    expect(result).toBe(false)
  })
  test('match multiple lists - true', async () => {
    const result = await MATCH_LIST_OPERATOR.run(
      'string_4',
      [testListId1, testListId2, 'unkown-list-id'],
      undefined,
      {
        tenantId: TEST_TENANT_ID,
        dynamoDb,
      }
    )
    expect(result).toBe(true)
  })
  test('match multiple list - false', async () => {
    const result = await MATCH_LIST_OPERATOR.run(
      'string_x',
      [testListId1, testListId2, 'unkown-list-id'],
      undefined,
      {
        tenantId: TEST_TENANT_ID,
        dynamoDb,
      }
    )
    expect(result).toBe(false)
  })
  test('match inactive list - false', async () => {
    const result = await MATCH_LIST_OPERATOR.run(
      'string_1',
      [testInactiveListId],
      undefined,
      {
        tenantId: TEST_TENANT_ID,
        dynamoDb,
      }
    )
    expect(result).toBe(false)
  })
})
