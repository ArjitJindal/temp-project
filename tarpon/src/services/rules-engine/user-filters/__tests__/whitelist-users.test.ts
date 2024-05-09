import { WhitelistUsersRuleFilter } from '../whitelist-users'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser } from '@/test-utils/user-test-utils'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

dynamoDbSetupHook()

const dynamodb = getDynamoDbClient()

filterVariantsTest({ v8: true }, () => {
  test('Empty parameter', async () => {
    expect(
      await new WhitelistUsersRuleFilter(
        getTestTenantId(),
        { user: getTestUser({ userId: '1' }) },
        { whitelistUsers: {} },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('User is in the whitelist user IDs - false', async () => {
    expect(
      await new WhitelistUsersRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({ userId: '1' }),
        },
        { whitelistUsers: { userIds: ['1'] } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('User is not in the whitelist user IDs - true', async () => {
    expect(
      await new WhitelistUsersRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({ userId: '2' }),
        },
        { whitelistUsers: { userIds: ['1'] } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('User is in the whitelist lists - false', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamodb)
    const { listId: listId1 } = await listRepo.createList(
      'WHITELIST',
      'USER_ID',
      {
        items: [{ key: '1' }, { key: '2' }],
        metadata: { status: true },
      }
    )
    const { listId: listId2 } = await listRepo.createList(
      'WHITELIST',
      'USER_ID',
      {
        items: [{ key: '3' }, { key: '4' }],
        metadata: { status: true },
      }
    )
    expect(
      await new WhitelistUsersRuleFilter(
        TEST_TENANT_ID,
        {
          user: getTestUser({ userId: '1' }),
        },
        { whitelistUsers: { listIds: [listId1, listId2] } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('User is not in the whitelist lists - true', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const listRepo = new ListRepository(TEST_TENANT_ID, dynamodb)
    const { listId: listId1 } = await listRepo.createList(
      'WHITELIST',
      'USER_ID',
      {
        items: [{ key: '1' }, { key: '2' }],
        metadata: { status: true },
      }
    )
    const { listId: listId2 } = await listRepo.createList(
      'WHITELIST',
      'USER_ID',
      {
        items: [{ key: '3' }, { key: '4' }],
        metadata: { status: true },
      }
    )
    expect(
      await new WhitelistUsersRuleFilter(
        TEST_TENANT_ID,
        {
          user: getTestUser({ userId: '11' }),
        },
        { whitelistUsers: { listIds: [listId1, listId2] } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
})
