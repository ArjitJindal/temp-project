import WhitelistUsersRuleFilter from '../whitelist-users'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser } from '@/test-utils/user-test-utils'
import { ListRepository } from '@/lambdas/console-api-list-importer/repositories/list-repository'

dynamoDbSetupHook()

const dynamodb = getDynamoDbClient()

test('Empty parameter', async () => {
  expect(
    await new WhitelistUsersRuleFilter(
      getTestTenantId(),
      { senderUser: getTestUser({ userId: '1' }) },
      { whitelistUsers: {} },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('sender/receiver is in the whitelist user IDs - false', async () => {
  expect(
    await new WhitelistUsersRuleFilter(
      getTestTenantId(),
      {
        senderUser: getTestUser({ userId: '1' }),
      },
      { whitelistUsers: { userIds: ['1'] } },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new WhitelistUsersRuleFilter(
      getTestTenantId(),
      {
        receiverUser: getTestUser({ userId: '1' }),
      },
      { whitelistUsers: { userIds: ['1'] } },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('sender/receiver is not in the whitelist user IDs - true', async () => {
  expect(
    await new WhitelistUsersRuleFilter(
      getTestTenantId(),
      {
        senderUser: getTestUser({ userId: '2' }),
      },
      { whitelistUsers: { userIds: ['1'] } },
      dynamodb
    ).predicate()
  ).toBe(true)
  expect(
    await new WhitelistUsersRuleFilter(
      getTestTenantId(),
      {
        receiverUser: getTestUser({ userId: '2' }),
      },
      { whitelistUsers: { userIds: ['1'] } },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('sender/receiver is in the whitelist lists - false', async () => {
  const TEST_TENANT_ID = getTestTenantId()
  const listRepo = new ListRepository(TEST_TENANT_ID, dynamodb)
  const { listId: listId1 } = await listRepo.createList('USERS-WHITELISTS', {
    items: [{ key: '1' }, { key: '2' }],
  })
  const { listId: listId2 } = await listRepo.createList('USERS-WHITELISTS', {
    items: [{ key: '3' }, { key: '4' }],
  })
  expect(
    await new WhitelistUsersRuleFilter(
      TEST_TENANT_ID,
      {
        senderUser: getTestUser({ userId: '1' }),
      },
      { whitelistUsers: { listIds: [listId1, listId2] } },
      dynamodb
    ).predicate()
  ).toBe(false)
  expect(
    await new WhitelistUsersRuleFilter(
      TEST_TENANT_ID,
      {
        receiverUser: getTestUser({ userId: '3' }),
      },
      { whitelistUsers: { listIds: [listId1, listId2] } },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('sender/receiver is not in the whitelist lists - true', async () => {
  const TEST_TENANT_ID = getTestTenantId()
  const listRepo = new ListRepository(TEST_TENANT_ID, dynamodb)
  const { listId: listId1 } = await listRepo.createList('USERS-WHITELISTS', {
    items: [{ key: '1' }, { key: '2' }],
  })
  const { listId: listId2 } = await listRepo.createList('USERS-WHITELISTS', {
    items: [{ key: '3' }, { key: '4' }],
  })
  expect(
    await new WhitelistUsersRuleFilter(
      TEST_TENANT_ID,
      {
        senderUser: getTestUser({ userId: '11' }),
      },
      { whitelistUsers: { listIds: [listId1, listId2] } },
      dynamodb
    ).predicate()
  ).toBe(true)
  expect(
    await new WhitelistUsersRuleFilter(
      TEST_TENANT_ID,
      {
        receiverUser: getTestUser({ userId: '22' }),
      },
      { whitelistUsers: { listIds: [listId1, listId2] } },
      dynamodb
    ).predicate()
  ).toBe(true)
})
