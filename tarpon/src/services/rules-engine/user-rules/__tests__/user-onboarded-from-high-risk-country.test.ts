import { UserOnboardedFromHighRiskCountryRuleParameters } from '../user-onboarded-from-high-risk-country'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  createUserRuleTestCase,
  setUpRulesHooks,
  UserRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { withLocalChangeHandler } from '@/utils/local-change-handler'
import { getTestUser } from '@/test-utils/user-test-utils'

dynamoDbSetupHook()
withLocalChangeHandler()

describe('Core logic', () => {
  describe.each<UserRuleTestCase>([
    {
      name: 'User onboarded from high risk country rule - nationality',
      users: [
        getTestUser({
          userId: 'U-1',
          userDetails: {
            countryOfNationality: 'AF',
            name: { firstName: 'John', lastName: 'Doe' },
            countryOfResidence: 'US',
          },
        }),
        getTestUser({
          userId: 'U-2',
          userDetails: {
            countryOfNationality: 'US',
            name: { firstName: 'John', lastName: 'Doe' },
            countryOfResidence: 'AF',
          },
        }),
        getTestUser({
          userId: 'U-3',
          userDetails: {
            countryOfNationality: 'US',
            name: { firstName: 'John', lastName: 'Doe' },
            countryOfResidence: 'US',
          },
        }),
      ],
      expectetRuleHitMetadata: [
        { hitDirections: ['ORIGIN'] },
        undefined,
        undefined,
      ],
    },
  ])(
    'User onboarded from high risk country rule',
    ({ name, users, expectetRuleHitMetadata }) => {
      const tennatId = getTestTenantId()

      setUpRulesHooks(tennatId, [
        {
          id: 'R-20',
          defaultParameters: {
            checksFor: ['nationality'],
            highRiskCountries: ['AF', 'IR', 'IQ', 'LY', 'KP', 'SY', 'YE'],
          } as UserOnboardedFromHighRiskCountryRuleParameters,
          type: 'USER',
        },
      ])

      createUserRuleTestCase(name, tennatId, users, expectetRuleHitMetadata)
    }
  )

  describe.each<UserRuleTestCase>([
    {
      name: 'User onboarded from high risk country rule - residence',
      users: [
        getTestUser({
          userId: 'U-1',
          userDetails: {
            countryOfNationality: 'AF',
            name: { firstName: 'John', lastName: 'Doe' },
            countryOfResidence: 'US',
          },
        }),
        getTestUser({
          userId: 'U-2',
          userDetails: {
            countryOfNationality: 'US',
            name: { firstName: 'John', lastName: 'Doe' },
            countryOfResidence: 'AF',
          },
        }),
        getTestUser({
          userId: 'U-3',
          userDetails: {
            countryOfNationality: 'US',
            name: { firstName: 'John', lastName: 'Doe' },
            countryOfResidence: 'US',
          },
        }),
      ],
      expectetRuleHitMetadata: [
        undefined,
        { hitDirections: ['ORIGIN'] },
        undefined,
      ],
    },
  ])(
    'User onboarded from high risk country rule',
    ({ name, users, expectetRuleHitMetadata }) => {
      const tennatId = getTestTenantId()

      setUpRulesHooks(tennatId, [
        {
          id: 'R-20',
          defaultParameters: {
            checksFor: ['residence'],
            highRiskCountries: ['AF', 'IR', 'IQ', 'LY', 'KP', 'SY', 'YE'],
          } as UserOnboardedFromHighRiskCountryRuleParameters,
          type: 'USER',
        },
      ])

      createUserRuleTestCase(name, tennatId, users, expectetRuleHitMetadata)
    }
  )
})
