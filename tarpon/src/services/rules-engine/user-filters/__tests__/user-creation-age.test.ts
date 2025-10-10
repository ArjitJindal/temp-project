import { UserCreationAgeRuleFilter } from '../user-creation-age'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser } from '@/test-utils/user-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

filterVariantsTest({ v8: true }, () => {
  test('Empty parameter', async () => {
    expect(
      await new UserCreationAgeRuleFilter(
        getTestTenantId(),
        { user: getTestUser({ userId: '1' }) },
        { userCreationAgeRange: {} },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Only min age set', async () => {
    expect(
      await new UserCreationAgeRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            userId: '1',
            createdTimestamp: dayjs().subtract(2, 'month').valueOf(),
          }),
        },
        {
          userCreationAgeRange: { minAge: { units: 1, granularity: 'month' } },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
    expect(
      await new UserCreationAgeRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            userId: '1',
            createdTimestamp: dayjs().subtract(2, 'month').valueOf(),
          }),
        },
        {
          userCreationAgeRange: { minAge: { units: 3, granularity: 'month' } },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Only max age set', async () => {
    expect(
      await new UserCreationAgeRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            userId: '1',
            createdTimestamp: dayjs().subtract(2, 'month').valueOf(),
          }),
        },
        {
          userCreationAgeRange: { maxAge: { units: 1, granularity: 'month' } },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
    expect(
      await new UserCreationAgeRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            userId: '1',
            createdTimestamp: dayjs().subtract(2, 'month').valueOf(),
          }),
        },
        {
          userCreationAgeRange: { maxAge: { units: 3, granularity: 'month' } },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Both min age and max age are set', async () => {
    expect(
      await new UserCreationAgeRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            userId: '1',
            createdTimestamp: dayjs().subtract(2, 'year').valueOf(),
          }),
        },
        {
          userCreationAgeRange: {
            minAge: { units: 1, granularity: 'month' },
            maxAge: { units: 1, granularity: 'year' },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
    expect(
      await new UserCreationAgeRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            userId: '1',
            createdTimestamp: dayjs().subtract(6, 'month').valueOf(),
          }),
        },
        {
          userCreationAgeRange: {
            minAge: { units: 1, granularity: 'month' },
            maxAge: { units: 1, granularity: 'year' },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
})
