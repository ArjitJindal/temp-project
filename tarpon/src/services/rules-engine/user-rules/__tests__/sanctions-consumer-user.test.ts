import { SanctionsConsumerUserRuleParameters } from '../sanctions-consumer-user'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  setUpRulesHooks,
  createUserRuleTestCase,
  UserRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  MOCK_CA_SEARCH_NO_HIT_RESPONSE,
  MOCK_CA_SEARCH_RESPONSE,
} from '@/test-utils/resources/mock-ca-search-response'
import { SanctionsService } from '@/services/sanctions'

const TEST_SANCTIONS_HITS = ['Vladimir Putin']
jest.mock('@/services/sanctions', () => {
  type SanctionsServiceInstanceType = InstanceType<typeof SanctionsService>
  return {
    SanctionsService: jest.fn().mockImplementation(() => {
      type SearchMethodType = SanctionsServiceInstanceType['search']
      return {
        search: jest
          .fn()
          .mockImplementation(
            async (
              ...params: Parameters<SearchMethodType>
            ): ReturnType<SearchMethodType> => {
              const [request] = params
              const rawComplyAdvantageResponse = TEST_SANCTIONS_HITS.includes(
                request.searchTerm
              )
                ? MOCK_CA_SEARCH_RESPONSE
                : MOCK_CA_SEARCH_NO_HIT_RESPONSE

              return {
                hitsCount: rawComplyAdvantageResponse.content.data.hits.length,
                searchId: 'test-search-id',
              }
            }
          ),
      }
    }),
  }
})

dynamoDbSetupHook()

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-16',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
      } as SanctionsConsumerUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestUser({}),
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Bar',
              lastName: 'Foo',
            },
          },
        }),
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Vladimir',
              lastName: 'Putin',
            },
          },
        }),
      ],
      expectetRuleHitMetadata: [
        undefined,
        undefined,
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Vladimir Putin',
              entityType: 'CONSUMER_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
          ],
        },
      ],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})

describe('Skip if ongoing screening mode if on but ongoingScreening is false', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-16',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
      } as SanctionsConsumerUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestUser({
          userDetails: {
            name: {
              firstName: 'Vladimir',
              lastName: 'Putin',
            },
          },
        }),
      ],
      expectetRuleHitMetadata: [undefined],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(
      name,
      TEST_TENANT_ID,
      users,
      expectetRuleHitMetadata,
      undefined,
      true
    )
  })
})
