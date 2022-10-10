import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { ListRepository } from '@/lambdas/console-api-list-importer/repositories/list-repository'
import { ListExisted as List } from '@/@types/openapi-internal/ListExisted'
import { CursorPaginatedResponse, getDynamoDbClient } from '@/utils/dynamodb'
import { ListItem } from '@/@types/openapi-public/ListItem'

dynamoDbSetupHook()

const LIST_TYPE = 'USERS-WHITELISTS'

describe('Verify list repository', () => {
  test('Getting list of lists', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const TYPE_1 = 'USERS-WHITELISTS'
    const TYPE_2 = 'USERS-BLACKLISTS'

    await listRepo.createList(TYPE_1)
    await listRepo.createList(TYPE_1)
    await listRepo.createList(TYPE_2)

    expect(await listRepo.getListHeaders(TYPE_2)).toHaveLength(1)
    expect(await listRepo.getListHeaders(TYPE_1)).toHaveLength(2)
    expect(await listRepo.getListHeaders()).toHaveLength(3)
  })
  test('Verify simple write-read', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const name = 'Test list'
    const items = [
      { key: 'a', metadata: { f1: 1 } },
      { key: 'b', metadata: { f2: 2 } },
      { key: 'c', metadata: { f3: 3 } },
    ]

    const {
      header: { listId },
    } = await listRepo.createList(LIST_TYPE, {
      metadata: {
        name,
      },
      items,
    })
    const header = await listRepo.getListHeader(LIST_TYPE, listId)
    expect(header).not.toBeNull()
    expect(header?.listId).toEqual(listId)
    expect(header?.size).toEqual(items.length)
    expect(header?.metadata?.name).toEqual(name)

    await listRepo.deleteList(LIST_TYPE, listId)
    const result_2 = await listRepo.getListHeader(LIST_TYPE, listId)
    expect(result_2).toBeNull()
  })
  test('Verify list delete', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)
    const { listId } = await listRepo.createList(LIST_TYPE, {
      items: [],
    })
    await listRepo.setListItem(LIST_TYPE, listId, {
      key: 'aaa',
      metadata: { f1: 1 },
    })
    await listRepo.setListItem(LIST_TYPE, listId, {
      key: 'bbb',
      metadata: { f1: 2 },
    })
    await listRepo.setListItem(LIST_TYPE, listId, {
      key: 'ccc',
      metadata: { f1: 3 },
    })
    await listRepo.deleteList(LIST_TYPE, listId)
    expect(await listRepo.getListHeader(LIST_TYPE, listId)).toBeNull()
    const headers = await listRepo.getListHeaders(LIST_TYPE)
    expect(headers.find((x) => x.listId === listId) ?? null).toBeNull()
  })
  test('Verify ordering', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const list = await listRepo.createList(LIST_TYPE, {
      items: [{ key: 'c' }, { key: 'b' }, { key: 'a' }],
    })

    const items = await getAllListItems(listRepo, list.header.listId)
    expect(items).toEqual([{ key: 'a' }, { key: 'b' }, { key: 'c' }])
  })
  test('Verify deduplication', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const list = await listRepo.createList(LIST_TYPE, {
      items: [
        { key: 'aaa', metadata: { f1: 1 } },
        { key: 'bbb', metadata: { f1: 2 } },
        { key: 'aaa', metadata: { f1: 3 } },
      ],
    })

    const items = await getAllListItems(listRepo, list.header.listId)
    expect(items).toEqual([
      { key: 'aaa', metadata: { f1: 3 } },
      { key: 'bbb', metadata: { f1: 2 } },
    ])
  })
  test('Verify overriding', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const { listId } = await listRepo.createList(LIST_TYPE)

    {
      await listRepo.updateListItems(LIST_TYPE, listId, [
        { key: 'aaa', metadata: { v: 1 } },
        { key: 'bbb', metadata: { v: 1 } },
        { key: 'ccc', metadata: { v: 1 } },
      ])
      const items = await getAllListItems(listRepo, listId)
      expect(items).toEqual([
        { key: 'aaa', metadata: { v: 1 } },
        { key: 'bbb', metadata: { v: 1 } },
        { key: 'ccc', metadata: { v: 1 } },
      ])
    }
    {
      await listRepo.updateListItems(LIST_TYPE, listId, [
        { key: 'ccc', metadata: { v: 2 } },
        { key: '111', metadata: { v: 2 } },
      ])
      const items = await getAllListItems(listRepo, listId)
      expect(items).toEqual([
        { key: '111', metadata: { v: 2 } },
        { key: 'aaa', metadata: { v: 1 } },
        { key: 'bbb', metadata: { v: 1 } },
        { key: 'ccc', metadata: { v: 2 } },
      ])
    }
  })
  test('Verify multiple items writing', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const { listId } = await listRepo.createList(LIST_TYPE)
    const items = [
      { key: 'aaa', metadata: { v: 1 } },
      { key: 'bbb', metadata: { v: 1 } },
      { key: 'ccc', metadata: { v: 1 } },
    ]
    await listRepo.updateListItems(LIST_TYPE, listId, items)
    const header = await listRepo.getListHeader(LIST_TYPE, listId)
    expect(header?.size).toEqual(items.length)
    const allItems = await getAllListItems(listRepo, listId)
    expect(allItems).toEqual(items)
  })
  test('Verify overriding of the same keys', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const { listId } = await listRepo.createList(LIST_TYPE)

    await listRepo.updateListItems(LIST_TYPE, listId, [
      { key: 'aaa', metadata: { f1: 1 } },
    ])
    await listRepo.updateListItems(LIST_TYPE, listId, [
      { key: 'aaa', metadata: { f1: 2 } },
    ])

    const result = await listRepo.getListItem(LIST_TYPE, listId, 'aaa')
    expect(result).toEqual({ key: 'aaa', metadata: { f1: 2 } })
    expect((await listRepo.getListHeader(LIST_TYPE, listId))?.size).toEqual(1)
  })
  test('Large arrays read/write', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const { listId } = await listRepo.createList(LIST_TYPE)
    const items = [...new Array(1000)].map((_, i) => ({
      key: i.toString(),
      metadata: { f1: Math.round(Math.cos(i) * Number.MAX_SAFE_INTEGER) },
    }))
    items.sort((x, y) => x.key.localeCompare(y.key))

    await listRepo.updateListItems(LIST_TYPE, listId, items)
    const resultItems = await getAllListItems(listRepo, listId)
    expect(resultItems).toEqual(items)
  })
  test('Fetch list of lists', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const lists: List[] = [
      await listRepo.createList(LIST_TYPE, {
        metadata: { name: 'a' },
        items: [],
      }),
      await listRepo.createList(LIST_TYPE, {
        metadata: { name: 'b' },
        items: [],
      }),
      await listRepo.createList(LIST_TYPE, {
        metadata: { name: 'c' },
        items: [],
      }),
    ]

    const headers = await listRepo.getListHeaders(LIST_TYPE)
    expect(headers.length).toEqual(lists.length)

    for (const list of lists) {
      const header = headers.find((x) => x.listId === list.listId)
      expect(header).not.toBeNull()
      expect(header?.metadata?.name).toEqual(list.header.metadata?.name)
      expect(header?.size).toEqual(list.items.length)
    }
  })
  test('Check key-value read/write API', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const {
      header: { listId },
    } = await listRepo.createList(LIST_TYPE, { items: [] })

    // Make sure empty list is empty
    {
      expect((await listRepo.getListHeader(LIST_TYPE, listId))?.size).toEqual(0)
    }

    // Try to write item and read it, should be the same
    {
      const listItem = { key: 'aaa', metadata: { f1: 42 } }
      await listRepo.setListItem(LIST_TYPE, listId, listItem)
      expect((await listRepo.getListHeader(LIST_TYPE, listId))?.size).toEqual(1)
      expect(
        await listRepo.getListItem(LIST_TYPE, listId, listItem.key)
      ).toEqual(listItem)
      await listRepo.deleteListItem(LIST_TYPE, listId, listItem.key)
      expect((await listRepo.getListHeader(LIST_TYPE, listId))?.size).toEqual(0)
    }

    // Try to override item
    {
      const key = 'aaa'
      const item1 = { key, metadata: { f1: 42 } }
      const item2 = { key, metadata: { f1: 666 } }
      await listRepo.setListItem(LIST_TYPE, listId, item1)
      expect(await listRepo.getListItem(LIST_TYPE, listId, key)).toEqual(item1)
      await listRepo.setListItem(LIST_TYPE, listId, item2)
      expect(await listRepo.getListItem(LIST_TYPE, listId, key)).toEqual(item2)
      await listRepo.deleteListItem(LIST_TYPE, listId, key)
    }

    // Trying to work with non existed list
    {
      const key = 'aaa'
      expect(
        listRepo.setListItem(LIST_TYPE, 'not_existed', { key })
      ).rejects.not.toBeNull()
      expect(
        listRepo.getListItem(LIST_TYPE, 'not_existed', key)
      ).rejects.not.toBeNull()
      expect(
        listRepo.deleteListItem(LIST_TYPE, 'not_existed', key)
      ).rejects.not.toBeNull()
    }

    // Trying to work with non existed key
    {
      const key = 'not_existed'
      expect(await listRepo.getListItem(LIST_TYPE, listId, key)).toBeNull()
    }
  })
  test('Test paginated keys reading', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const initialValues = [...new Array(100)].map((_, i) => ({
      key: `key_${i.toString().padStart(4, '0')}`,
      metadata: {
        index: i,
        payload: [...new Array(100000)].map(() => 'a').join(''),
      },
    }))

    const { listId } = await listRepo.createList(LIST_TYPE, {
      items: initialValues,
    })

    let cursor = undefined
    const readResult = []
    do {
      const r: CursorPaginatedResponse<ListItem> = await listRepo.getListItems(
        LIST_TYPE,
        listId,
        {
          cursor,
        }
      )
      cursor = r.cursor
      readResult.push(...r.items)
    } while (cursor != null)

    expect(readResult.length).toEqual(initialValues.length)
    for (let i = 0; i < initialValues.length; i += 1) {
      const x = initialValues[i]
      const y = readResult[i]
      expect(x).toEqual(y)
    }
  })
  test('Test counting values', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const initialValues = [...new Array(100)].map((_, i) => ({
      key: `key_${i.toString().padStart(4, '0')}`,
      metadata: {
        index: i,
        payload: [...new Array(100000)].map(() => 'a').join(''),
      },
    }))

    const { listId } = await listRepo.createList(LIST_TYPE, {
      items: initialValues,
    })
    const total = await listRepo.countListValues(LIST_TYPE, listId)
    expect(total).toEqual(initialValues.length)
  })
  test('Test matching values', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)
    const { listId } = await listRepo.createList(LIST_TYPE, {
      items: [{ key: 'aaabbb' }, { key: 'ccc' }, { key: 'aaaccc' }],
    })
    expect(await listRepo.match(listId, 'aaabbb', 'EXACT')).toEqual(true)
    expect(await listRepo.match(listId, 'aaab', 'PREFIX')).toEqual(true)
    expect(await listRepo.match(listId, 'aaa', 'EXACT')).toEqual(false)
    expect(await listRepo.match(listId, 'aaa', 'PREFIX')).toEqual(true)
    expect(await listRepo.match(listId, 'aaabbbb', 'EXACT')).toEqual(false)
    expect(await listRepo.match(listId, 'bbb', 'PREFIX')).toEqual(false)
    expect(await listRepo.match(listId, 'ddd', 'EXACT')).toEqual(false)
  })
})

async function getAllListItems(listRepo: ListRepository, listId: string) {
  const result = []
  let nextCursor = undefined
  do {
    const response: CursorPaginatedResponse<ListItem> =
      await listRepo.getListItems(LIST_TYPE, listId, {
        cursor: nextCursor,
      })
    nextCursor = response.cursor
    result.push(...response.items)
  } while (nextCursor != null)
  return result
}
