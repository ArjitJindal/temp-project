import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { ListExistedInternal as List } from '@/@types/openapi-internal/ListExistedInternal'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListItem } from '@/@types/openapi-public/ListItem'
import { CursorPaginationResponse } from '@/utils/pagination'

dynamoDbSetupHook()

const LIST_TYPE = 'WHITELIST'

describe('Verify list repository', () => {
  test('Getting list of lists', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const TYPE_1 = 'WHITELIST'
    const TYPE_2 = 'BLACKLIST'

    await listRepo.createList(TYPE_1, 'USER_ID')
    await listRepo.createList(TYPE_1, 'USER_ID')
    await listRepo.createList(TYPE_2, 'USER_ID')

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
    } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      metadata: {
        name,
      },
      items,
    })
    const header = await listRepo.getListHeader(listId)
    expect(header).not.toBeNull()
    expect(header?.listId).toEqual(listId)
    expect(header?.size).toEqual(items.length)
    expect(header?.metadata?.name).toEqual(name)

    await listRepo.deleteList(listId)
    const result_2 = await listRepo.getListHeader(listId)
    expect(result_2).toBeNull()
  })
  test('Verify list delete', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)
    const { listId } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      items: [],
    })
    await listRepo.setListItem(listId, {
      key: 'aaa',
      metadata: { f1: 1 },
    })
    await listRepo.setListItem(listId, {
      key: 'bbb',
      metadata: { f1: 2 },
    })
    await listRepo.setListItem(listId, {
      key: 'ccc',
      metadata: { f1: 3 },
    })
    await listRepo.deleteList(listId)
    expect(await listRepo.getListHeader(listId)).toBeNull()
    const headers = await listRepo.getListHeaders(LIST_TYPE)
    expect(headers.find((x) => x.listId === listId) ?? null).toBeNull()
  })
  test('Verify ordering', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const list = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      items: [{ key: 'c' }, { key: 'b' }, { key: 'a' }],
    })

    const items = await getAllListItems(listRepo, list.header.listId)
    expect(items).toEqual([{ key: 'a' }, { key: 'b' }, { key: 'c' }])
  })
  test('Verify deduplication', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const list = await listRepo.createList(LIST_TYPE, 'USER_ID', {
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

    const { listId } = await listRepo.createList(LIST_TYPE, 'USER_ID', {})

    {
      await listRepo.updateListItems(listId, [
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
      await listRepo.updateListItems(listId, [
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

    const { listId } = await listRepo.createList(LIST_TYPE, 'USER_ID', {})
    const items = [
      { key: 'aaa', metadata: { v: 1 } },
      { key: 'bbb', metadata: { v: 1 } },
      { key: 'ccc', metadata: { v: 1 } },
    ]
    await listRepo.updateListItems(listId, items)
    const header = await listRepo.getListHeader(listId)
    expect(header?.size).toEqual(items.length)
    const allItems = await getAllListItems(listRepo, listId)
    expect(allItems).toEqual(items)
  })
  test('Verify overriding of the same keys', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const { listId } = await listRepo.createList(LIST_TYPE, 'USER_ID', {})

    await listRepo.updateListItems(listId, [
      { key: 'aaa', metadata: { f1: 1 } },
    ])
    await listRepo.updateListItems(listId, [
      { key: 'aaa', metadata: { f1: 2 } },
    ])

    const result = await listRepo.getListItem(listId, 'aaa')
    expect(result).toEqual({ key: 'aaa', metadata: { f1: 2 } })
    expect((await listRepo.getListHeader(listId))?.size).toEqual(1)
  })
  test('Large arrays read/write', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const { listId } = await listRepo.createList(LIST_TYPE, 'USER_ID', {})
    const items = [...new Array(100)].map((_, i) => ({
      key: i.toString(),
      metadata: { f1: Math.round(Math.cos(i) * Number.MAX_SAFE_INTEGER) },
    }))
    items.sort((x, y) => x.key.localeCompare(y.key))

    await listRepo.updateListItems(listId, items)
    const resultItems = await getAllListItems(listRepo, listId)
    expect(resultItems).toEqual(items)
  })
  test('Fetch list of lists', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const lists: List[] = [
      await listRepo.createList(LIST_TYPE, 'USER_ID', {
        metadata: { name: 'a' },
        items: [],
      }),
      await listRepo.createList(LIST_TYPE, 'USER_ID', {
        metadata: { name: 'b' },
        items: [],
      }),
      await listRepo.createList(LIST_TYPE, 'USER_ID', {
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
    } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      items: [],
    })

    // Make sure empty list is empty
    {
      expect((await listRepo.getListHeader(listId))?.size).toEqual(0)
    }

    // Try to write item and read it, should be the same
    {
      const listItem = { key: 'aaa', metadata: { f1: 42 } }
      await listRepo.setListItem(listId, listItem)
      expect((await listRepo.getListHeader(listId))?.size).toEqual(1)
      expect(await listRepo.getListItem(listId, listItem.key)).toEqual(listItem)
      await listRepo.deleteListItem(listId, listItem.key)
      expect((await listRepo.getListHeader(listId))?.size).toEqual(0)
    }

    // Try to override item
    {
      const key = 'aaa'
      const item1 = { key, metadata: { f1: 42 } }
      const item2 = { key, metadata: { f1: 666 } }
      await listRepo.setListItem(listId, item1)
      expect(await listRepo.getListItem(listId, key)).toEqual(item1)
      await listRepo.setListItem(listId, item2)
      expect(await listRepo.getListItem(listId, key)).toEqual(item2)
      await listRepo.deleteListItem(listId, key)
    }

    // Trying to work with non existed list
    {
      const key = 'aaa'
      await expect(
        listRepo.setListItem('not_existed', { key })
      ).rejects.not.toBeNull()
      await expect(
        listRepo.getListItem('not_existed', key)
      ).rejects.not.toBeNull()
      await expect(
        listRepo.deleteListItem('not_existed', key)
      ).rejects.not.toBeNull()
    }

    // Trying to work with non existed key
    {
      const key = 'not_existed'
      expect(await listRepo.getListItem(listId, key)).toBeNull()
    }
  })
  test('Check batch write API', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const {
      header: { listId },
    } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      items: [],
    })

    // Make sure empty list is empty
    {
      expect((await listRepo.getListHeader(listId))?.size).toEqual(0)
    }

    // Try to write item and read it, should be the same
    {
      const listItems = [
        { key: 'aaa', metadata: { f1: 42 } },
        { key: 'bbb', metadata: { f1: 43 } },
        { key: 'ccc', metadata: { f1: 44 } },
      ]
      await listRepo.setListItems(listId, listItems)
      expect((await listRepo.getListHeader(listId))?.size).toEqual(3)
      expect(await listRepo.getListItem(listId, listItems[0].key)).toEqual(
        listItems[0]
      )
      expect(await listRepo.getListItem(listId, listItems[1].key)).toEqual(
        listItems[1]
      )
      expect(await listRepo.getListItem(listId, listItems[2].key)).toEqual(
        listItems[2]
      )
    }
  })
  test('Write 100 items', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    const {
      header: { listId },
    } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      items: [],
    })

    // Make sure empty list is empty
    {
      expect((await listRepo.getListHeader(listId))?.size).toEqual(0)
    }

    // Try to write item and read it, should be the same
    {
      const data = [...new Array(100)].map((_, i) => ({
        key: 'key#' + i,
        metadata: { reason: 'Test reason #' + i },
      }))
      await listRepo.setListItems(listId, data)
      expect((await listRepo.getListHeader(listId))?.size).toEqual(100)
    }
  })

  describe('Pagination', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)

    test('One page data, fetch first page', async () => {
      const ITEMS_COUNT = 20

      const { listId } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
        items: [...new Array(ITEMS_COUNT)].map((_, i) => ({
          key: `key_${(i + 1).toString().padStart(2, '0')}`,
          metadata: {
            index: i,
            payload: `value_${i.toString().padStart(2, '0')}`,
          },
        })),
      })

      const r: CursorPaginationResponse<ListItem> = await listRepo.getListItems(
        listId
      )
      expect(r.next).toEqual('')
      expect(r.prev).toEqual('')
      expect(r.hasPrev).toEqual(false)
      expect(r.hasNext).toEqual(false)
      expect(r.count).toEqual(ITEMS_COUNT)
    })

    describe('2 pages, second page with 1 item', () => {
      const ITEMS_COUNT = 21
      const newList = {
        items: [...new Array(ITEMS_COUNT)].map((_, i) => ({
          key: `key_${(i + 1).toString().padStart(2, '0')}`,
          metadata: {
            index: i,
            payload: `value_${i.toString().padStart(2, '0')}`,
          },
        })),
      }
      test('Fetch first page, last item should be next cursor', async () => {
        const { listId } = await listRepo.createList(
          LIST_TYPE,
          'USER_ID',
          newList
        )

        const r: CursorPaginationResponse<ListItem> =
          await listRepo.getListItems(listId)
        expect(r.pageSize).toEqual(20)
        expect(r.items).toHaveLength(20)
        expect(r.count).toEqual(ITEMS_COUNT)
        expect(r.next).toEqual('key_20')
        expect(r.prev).toEqual('')
        expect(r.hasNext).toEqual(true)
        expect(r.hasPrev).toEqual(false)
      })

      test('Fetch second page', async () => {
        const { listId } = await listRepo.createList(
          LIST_TYPE,
          'USER_ID',
          newList
        )

        const r: CursorPaginationResponse<ListItem> =
          await listRepo.getListItems(listId, {
            fromCursorKey: 'key_20',
          })
        expect(r.items).toHaveLength(1)
        expect(r.items[0].key).toEqual('key_21')
        expect(r.next).toEqual('')
        expect(r.prev).toEqual('')
        expect(r.hasNext).toEqual(false)
        expect(r.hasPrev).toEqual(true)
        expect(r.count).toEqual(ITEMS_COUNT)
      })

      test('Fetch all items', async () => {
        const { listId } = await listRepo.createList(
          LIST_TYPE,
          'USER_ID',
          newList
        )

        let listCursor = await listRepo.getListItems(listId, { pageSize: 10 })
        const allItems: ListItem[] = []
        allItems.push(...listCursor.items)
        while (listCursor.hasNext) {
          listCursor = await listRepo.getListItems(listId, {
            fromCursorKey: listCursor.next,
            pageSize: 10,
          })
          allItems.push(...listCursor.items)
        }
        expect(allItems.length).toEqual(ITEMS_COUNT)
      })
    })
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

    const { listId } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      items: initialValues,
    })
    const total = await listRepo.countListValues(listId)
    expect(total).toEqual(initialValues.length)
  })
  test('Test matching values', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const dynamoDb = getDynamoDbClient()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamoDb)
    const { header } = await listRepo.createList(LIST_TYPE, 'USER_ID', {
      items: [{ key: 'aaabbb' }, { key: 'ccc' }, { key: 'aaaccc' }],
    })
    expect(await listRepo.match(header, 'aaabbb', 'EXACT')).toEqual(true)
    expect(await listRepo.match(header, 'aaab', 'PREFIX')).toEqual(true)
    expect(await listRepo.match(header, 'aaa', 'EXACT')).toEqual(false)
    expect(await listRepo.match(header, 'aaa', 'PREFIX')).toEqual(true)
    expect(await listRepo.match(header, 'aaabbbb', 'EXACT')).toEqual(false)
    expect(await listRepo.match(header, 'bbb', 'PREFIX')).toEqual(false)
    expect(await listRepo.match(header, 'ddd', 'EXACT')).toEqual(false)
  })
})

async function getAllListItems(listRepo: ListRepository, listId: string) {
  const result: any[] = []
  let nextCursor: any = undefined
  do {
    const response = await listRepo.getListItems(listId, {
      fromCursorKey: nextCursor,
    })
    nextCursor = response.next
    result.push(...response.items)
  } while (nextCursor)
  return result
}
