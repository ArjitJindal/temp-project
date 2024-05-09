import { UserStatusRuleFilter } from '../user-status'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamoDb = getDynamoDbClient()

const TEST_CONSUMER_USER_WITH_CREATED_USER_STATUS = getTestUser({
  userId: '1',
  userStateDetails: {
    state: 'CREATED',
  },
})

const TEST_CONSUMER_USER_WITH_ACTIVE_USER_STATUS = getTestUser({
  userId: '2',
  userStateDetails: {
    state: 'ACTIVE',
  },
})

const TEST_CONSUMER_USER_WITH_NO_USER_STATUS = getTestUser({
  userId: '3',
})

const TEST_CONSUMER_USER_WITH_BLOCKED_STATUS = getTestUser({
  userId: '4',
  userStateDetails: {
    state: 'BLOCKED',
  },
})

const TEST_BUSINESS_USER_WITH_CREATED_USER_STATUS = getTestBusiness({
  userId: '5',
  userStateDetails: {
    state: 'CREATED',
  },
})

const TEST_BUSINESS_USER_WITH_NO_USER_STATUS = getTestBusiness({
  userId: '6',
})

const tenantId = getTestTenantId()

filterVariantsTest({ v8: true }, () => {
  describe('UserStatusRuleFilter', () => {
    test('Empty parameter', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_CREATED_USER_STATUS,
          },
          {},
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('User status match the filter', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_CREATED_USER_STATUS,
          },
          { userStatus: ['CREATED'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('User status does not match the filter', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_BLOCKED_STATUS,
          },
          { userStatus: ['DORMANT'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User status match the filter for Business user', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_BUSINESS_USER_WITH_CREATED_USER_STATUS,
          },
          { userStatus: ['CREATED'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('User status match the filter', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_ACTIVE_USER_STATUS,
          },
          { userStatus: ['ACTIVE'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('User status for business user does not match the filter', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_BUSINESS_USER_WITH_CREATED_USER_STATUS,
          },
          { userStatus: ['ACTIVE'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User status for business user does not match the filter - status undefined', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_BUSINESS_USER_WITH_NO_USER_STATUS,
          },
          { userStatus: ['BLOCKED'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User status for consumer user does not match the filter - status undefined', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_NO_USER_STATUS,
          },
          { userStatus: ['ACTIVE'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User status match the filter', async () => {
      expect(
        await new UserStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_BLOCKED_STATUS,
          },
          { userStatus: ['DORMANT', 'BLOCKED'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })
  })
})
