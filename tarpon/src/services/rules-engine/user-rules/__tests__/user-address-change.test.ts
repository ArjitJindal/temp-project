import { nanoid } from 'nanoid'
import { RuleHitDirection } from '@/@types/openapi-internal/RuleHitDirection'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  createUserRuleTestCase,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  getTestBusiness,
  getTestUser,
  setUpUsersHooks,
} from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()

describe('Test User Address Change', () => {
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-61',
      defaultParameters: {},
    },
  ])

  describe.each([
    {
      name: 'User Address Change When User Does Not Exist',
      users: [
        getTestUser({
          userId: nanoid(),
          contactDetails: {
            addresses: [
              {
                addressLines: ['123 Main Street'],
                city: 'New York',
                country: 'US',
                postcode: '10001',
                state: 'NY',
              },
            ],
          },
        }),
      ],
      expectetRuleHitMetadata: [undefined],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })

  const userId1 = nanoid()

  describe.each([
    {
      name: 'User Address Existing and New are the same',
      users: [
        getTestUser({
          userId: userId1,
          contactDetails: {
            addresses: [
              {
                addressLines: ['123 Main Street'],
                city: 'New York',
                country: 'US',
                postcode: '10001',
                state: 'NY',
              },
            ],
          },
        }),
        getTestUser({
          userId: userId1,
          contactDetails: {
            addresses: [
              {
                addressLines: ['123 Main Street'],
                city: 'New Delhi',
                country: 'US',
                postcode: '10001',
                state: 'NY',
              },
            ],
          },
        }),
        getTestUser({
          userId: userId1,
          contactDetails: {
            addresses: [
              {
                addressLines: ['123 Main Street'],
                city: 'New Delhi',
                country: 'US',
                postcode: '10001',
                state: 'NY',
              },
              {
                addressLines: ['Calle 13'],
                city: 'New Delhi',
                country: 'IN',
                postcode: '121001',
                state: 'DL',
              },
            ],
          },
        }),
      ],
      expectetRuleHitMetadata: [
        undefined,
        {
          hitDirections: ['ORIGIN'] as RuleHitDirection[],
        },
        {
          hitDirections: ['ORIGIN'] as RuleHitDirection[],
        },
      ],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    setUpUsersHooks(TEST_TENANT_ID, [users[0]])
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})

describe('Test Business Address Change', () => {
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-61',
      defaultParameters: {},
    },
  ])

  describe.each([
    {
      name: 'Business Address Change When Business Does Not Exist',
      users: [
        getTestBusiness({
          userId: nanoid(),
          legalEntity: {
            ...getTestBusiness().legalEntity,
            contactDetails: {
              addresses: [
                {
                  addressLines: ['123 Main Street'],
                  city: 'New York',
                  country: 'US',
                  postcode: '10001',
                  state: 'NY',
                },
              ],
            },
          },
        }),
      ],
      expectetRuleHitMetadata: [undefined],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })

  const userId1 = nanoid()

  describe.each([
    {
      name: 'Business Address Existing and New are the same',
      users: [
        getTestBusiness({
          userId: userId1,
          legalEntity: {
            ...getTestBusiness().legalEntity,
            contactDetails: {
              addresses: [
                {
                  addressLines: ['123 Main Street'],
                  city: 'New York',
                  country: 'US',
                  postcode: '10001',
                  state: 'NY',
                },
              ],
            },
          },
        }),
        getTestBusiness({
          userId: userId1,
          legalEntity: {
            ...getTestBusiness().legalEntity,
            contactDetails: {
              addresses: [
                {
                  addressLines: ['123 Main Street'],
                  city: 'New Delhi',
                  country: 'US',
                  postcode: '10001',
                  state: 'NY',
                },
              ],
            },
          },
        }),
        getTestBusiness({
          userId: userId1,
          legalEntity: {
            ...getTestBusiness().legalEntity,
            contactDetails: {
              addresses: [
                {
                  addressLines: ['123 Main Street'],
                  city: 'New Delhi',
                  country: 'US',
                  postcode: '10001',
                  state: 'NY',
                },
                {
                  addressLines: ['Calle 13'],
                  city: 'New Delhi',
                  country: 'IN',
                  postcode: '121001',
                  state: 'DL',
                },
              ],
            },
          },
        }),
      ],
      expectetRuleHitMetadata: [
        undefined,
        {
          hitDirections: ['ORIGIN'] as RuleHitDirection[],
        },
        {
          hitDirections: ['ORIGIN'] as RuleHitDirection[],
        },
      ],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    setUpUsersHooks(TEST_TENANT_ID, [users[0]])
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})
