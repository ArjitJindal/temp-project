import { UserAgeRuleFilter } from '../user-age'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser } from '@/test-utils/user-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

const TEST_USER_20_YEAR_OLD = getTestUser({
  userId: '1',
  userDetails: {
    name: { firstName: 'user' },
    dateOfBirth: dayjs().subtract(20, 'year').format('YYYY-MM-DD'),
  },
})

filterVariantsTest({ v8: true }, () => {
  test('Empty parameter', async () => {
    expect(
      await new UserAgeRuleFilter(
        getTestTenantId(),
        { user: getTestUser({ userId: '1' }) },
        { userAgeRange: {} },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Only min age set', async () => {
    expect(
      await new UserAgeRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER_20_YEAR_OLD,
        },
        { userAgeRange: { minAge: { units: 18, granularity: 'year' } } },
        dynamodb
      ).predicate()
    ).toBe(true)
    expect(
      await new UserAgeRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER_20_YEAR_OLD,
        },
        { userAgeRange: { minAge: { units: 40, granularity: 'year' } } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Only max age set', async () => {
    expect(
      await new UserAgeRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER_20_YEAR_OLD,
        },
        { userAgeRange: { maxAge: { units: 18, granularity: 'year' } } },
        dynamodb
      ).predicate()
    ).toBe(false)
    expect(
      await new UserAgeRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER_20_YEAR_OLD,
        },
        { userAgeRange: { maxAge: { units: 80, granularity: 'year' } } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Both min age and max age are set', async () => {
    expect(
      await new UserAgeRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER_20_YEAR_OLD,
        },
        {
          userAgeRange: {
            minAge: { units: 30, granularity: 'year' },
            maxAge: { units: 40, granularity: 'year' },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
    expect(
      await new UserAgeRuleFilter(
        getTestTenantId(),
        {
          user: TEST_USER_20_YEAR_OLD,
        },
        {
          userAgeRange: {
            minAge: { units: 10, granularity: 'year' },
            maxAge: { units: 30, granularity: 'year' },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
})
