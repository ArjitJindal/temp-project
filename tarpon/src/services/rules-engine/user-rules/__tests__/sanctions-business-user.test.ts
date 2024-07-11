import { SanctionsBusinessUserRuleParameters } from '../sanctions-business-user'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
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

const TEST_SANCTIONS_HITS = ['Company Name', 'Director 1', 'Shareholder 1']

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

describe('Sanctions hit', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-128',
      defaultParameters: {
        entityTypes: ['LEGAL_NAME', 'DIRECTOR', 'SHAREHOLDER'],
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
      } as SanctionsBusinessUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestUser({
          userId: '1-1',
          userDetails: {
            name: {
              firstName: 'Bar',
              lastName: 'Foo',
            },
          },
        }),
        getTestBusiness({
          userId: '1-1',
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
            },
          },
        }),
        getTestBusiness({
          userId: '1-1',
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
            },
          },
          shareHolders: undefined,
          directors: [
            {
              generalDetails: {
                name: {
                  firstName: 'Director',
                  lastName: '1',
                },
              },
            },
          ],
        }),
        getTestBusiness({
          userId: '1-1',
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
            },
          },
          directors: [
            {
              generalDetails: {
                name: {
                  firstName: 'Director',
                  lastName: '1',
                },
              },
            },
          ],
          shareHolders: [
            {
              generalDetails: {
                name: {
                  firstName: 'Shareholder',
                  lastName: '1',
                },
              },
            },
          ],
        }),
      ],
      expectetRuleHitMetadata: [
        undefined,
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Company Name',
              entityType: 'LEGAL_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
          ],
        },
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Company Name',
              entityType: 'LEGAL_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
            {
              name: 'Director 1',
              entityType: 'DIRECTOR',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
          ],
        },
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Company Name',
              entityType: 'LEGAL_NAME',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
            {
              name: 'Director 1',
              entityType: 'DIRECTOR',
              searchId: expect.any(String),
              hitContext: expect.any(Object),
            },
            {
              name: 'Shareholder 1',
              entityType: 'SHAREHOLDER',
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

describe('Sanctions no hit', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-128',
      defaultParameters: {
        entityTypes: ['LEGAL_NAME', 'DIRECTOR', 'SHAREHOLDER'],
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
      } as SanctionsBusinessUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestBusiness({
          userId: '1-1',
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name 2',
            },
          },
          directors: [
            {
              generalDetails: {
                name: {
                  firstName: 'Director',
                  lastName: '2',
                },
              },
            },
          ],
          shareHolders: [
            {
              generalDetails: {
                name: {
                  firstName: 'Shareholder',
                  lastName: '2',
                },
              },
            },
          ],
        }),
      ],
      expectetRuleHitMetadata: [undefined],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})

describe('Skip if ongoing screening mode if on but ongoingScreening is false', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-128',
      defaultParameters: {
        entityTypes: ['LEGAL_NAME', 'DIRECTOR', 'SHAREHOLDER'],
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
      } as SanctionsBusinessUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestBusiness({
          userId: '1-1',
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
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
