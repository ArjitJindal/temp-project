import { UserIdRuleFilter } from '../user-id'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser } from '@/test-utils/user-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

const TEST_USER = getTestUser({
  userId: '1',
  userDetails: {
    name: { firstName: 'user' },
    dateOfBirth: dayjs().subtract(20, 'year').format('YYYY-MM-DD'),
  },
})

filterVariantsTest({ v8: true }, () => {
  test('User in the target IDs', async () => {
    expect(
      await new UserIdRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER,
        },
        { userIds: ['3', '1'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('User not in the target IDs', async () => {
    expect(
      await new UserIdRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER,
        },
        { userIds: ['3', '2'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })
})
