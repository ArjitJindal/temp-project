import { UserCountryOfRegistrationRuleFilter } from '../user-country-of-registration'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestBusiness } from '@/test-utils/user-test-utils'

const dynamodb = getDynamoDbClient()

const BUSINESS_TEST_USER = getTestBusiness({
  userId: '1',
  legalEntity: {
    companyGeneralDetails: {
      legalName: 'user',
    },
    companyRegistrationDetails: {
      registrationIdentifier: 'random',
      registrationCountry: 'JP',
    },
  },
})

test('Transaction country of registration match the filter - business director user', async () => {
  expect(
    await new UserCountryOfRegistrationRuleFilter(
      getTestTenantId(),
      {
        user: BUSINESS_TEST_USER,
      },
      {
        userRegistrationCountries: ['JP'],
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})
test('Transaction country of registration doesnot match the filter - business director user', async () => {
  expect(
    await new UserCountryOfRegistrationRuleFilter(
      getTestTenantId(),
      {
        user: BUSINESS_TEST_USER,
      },
      {
        userRegistrationCountries: ['AF'],
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})
