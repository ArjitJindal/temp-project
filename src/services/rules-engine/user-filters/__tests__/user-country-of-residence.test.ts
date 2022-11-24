import UserCountryOfResidenceRuleFilter from '../user-country-of-residence'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestUser, getTestBusiness } from '@/test-utils/user-test-utils'

const dynamodb = getDynamoDbClient()

const CONSUMER_TEST_USER = getTestUser({
  userId: '1',
  userDetails: {
    name: { firstName: 'user' },
    countryOfResidence: 'IN',
  },
})
const BUSINESS_TEST_USER = getTestBusiness({
  userId: '1',
  shareHolders: [
    {
      generalDetails: {
        name: { firstName: 'user' },
        countryOfResidence: 'BE',
      },
    },
  ],
  directors: [
    {
      generalDetails: {
        name: { firstName: 'user' },
        countryOfResidence: 'CN',
      },
    },
  ],
})

test('Transaction country of residence match the filter - consumer user', async () => {
  expect(
    await new UserCountryOfResidenceRuleFilter(
      getTestTenantId(),
      {
        user: CONSUMER_TEST_USER,
      },
      { userResidenceCountries: ['IN'] },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Transaction country of residence doesnot match the filter - consumer user', async () => {
  expect(
    await new UserCountryOfResidenceRuleFilter(
      getTestTenantId(),
      {
        user: CONSUMER_TEST_USER,
      },
      { userResidenceCountries: ['MV'] },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction country of residence match the filter - business shareholder user', async () => {
  expect(
    await new UserCountryOfResidenceRuleFilter(
      getTestTenantId(),
      {
        user: BUSINESS_TEST_USER,
      },
      {
        userResidenceCountries: ['BE'],
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})
test('Transaction country of residence doesnot match the filter - business shareholder user', async () => {
  expect(
    await new UserCountryOfResidenceRuleFilter(
      getTestTenantId(),
      {
        user: BUSINESS_TEST_USER,
      },
      {
        userResidenceCountries: ['AF'],
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})
test('Transaction country of residence match the filter - business director user', async () => {
  expect(
    await new UserCountryOfResidenceRuleFilter(
      getTestTenantId(),
      {
        user: BUSINESS_TEST_USER,
      },
      {
        userResidenceCountries: ['CN'],
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})
test('Transaction country of residence doesnot match the filter - business director user', async () => {
  expect(
    await new UserCountryOfResidenceRuleFilter(
      getTestTenantId(),
      {
        user: BUSINESS_TEST_USER,
      },
      {
        userResidenceCountries: ['AF'],
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})
