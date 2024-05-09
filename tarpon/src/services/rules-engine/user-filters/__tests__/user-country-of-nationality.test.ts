import { UserCountryOfNationalityRuleFilter } from '../user-country-of-nationality'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser, getTestBusiness } from '@/test-utils/user-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()

const CONSUMER_TEST_USER = getTestUser({
  userId: '1',
  userDetails: {
    name: { firstName: 'user' },
    countryOfNationality: 'AF',
  },
})
const BUSINESS_TEST_USER = getTestBusiness({
  userId: '1',

  shareHolders: [
    {
      generalDetails: {
        name: { firstName: 'user' },
        countryOfNationality: 'DE',
      },
    },
  ],
  directors: [
    {
      generalDetails: {
        name: { firstName: 'user' },
        countryOfNationality: 'IR',
      },
    },
  ],
})

filterVariantsTest({ v8: true }, () => {
  test('Transaction country of nationality match the filter - consumer user', async () => {
    expect(
      await new UserCountryOfNationalityRuleFilter(
        getTestTenantId(),
        {
          user: CONSUMER_TEST_USER,
        },
        { userNationalityCountries: ['AF'] },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transaction country of nationality doesnot match the filter - consumer user', async () => {
    expect(
      await new UserCountryOfNationalityRuleFilter(
        getTestTenantId(),
        {
          user: CONSUMER_TEST_USER,
        },
        { userNationalityCountries: ['IN'] },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction country of nationality match the filter - business shareholder user', async () => {
    expect(
      await new UserCountryOfNationalityRuleFilter(
        getTestTenantId(),
        {
          user: BUSINESS_TEST_USER,
        },
        {
          userNationalityCountries: ['DE'],
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
  test('Transaction country of nationality doesnot match the filter - business shareholder user', async () => {
    expect(
      await new UserCountryOfNationalityRuleFilter(
        getTestTenantId(),
        {
          user: BUSINESS_TEST_USER,
        },
        {
          userNationalityCountries: ['AF'],
        },
        dynamodb
      ).predicate()
    ).toBe(false)
  })
  test('Transaction country of nationality match the filter - business director user', async () => {
    expect(
      await new UserCountryOfNationalityRuleFilter(
        getTestTenantId(),
        {
          user: BUSINESS_TEST_USER,
        },
        {
          userNationalityCountries: ['IR'],
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
  test('Transaction country of nationality doesnot match the filter - business director user', async () => {
    expect(
      await new UserCountryOfNationalityRuleFilter(
        getTestTenantId(),
        {
          user: BUSINESS_TEST_USER,
        },
        {
          userNationalityCountries: ['AF'],
        },
        dynamodb
      ).predicate()
    ).toBe(false)
  })
})
