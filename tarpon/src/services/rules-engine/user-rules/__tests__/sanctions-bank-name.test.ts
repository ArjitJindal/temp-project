import { SanctionsBankUserRuleParameters } from '../sanctions-bank-name'
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

const TEST_TENANT_ID = getTestTenantId()
const TEST_SANCTIONS_HITS = ['Bank 1', 'Bank 3']

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
                providerSearchId: 'test-provider-search-id',
                createdAt: 1683301138980,
              }
            }
          ),
      }
    }),
  }
})

dynamoDbSetupHook()

describe('Sanctions bank name', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-32',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
        ruleStages: ['INITIAL', 'UPDATE', 'ONGOING'],
        fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
      } as SanctionsBankUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestBusiness({
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
            },
          },
          savedPaymentDetails: [
            {
              method: 'IBAN',
              IBAN: 'DE19500105178788668945',
            },
          ],
        }),
      ],
      expectetRuleHitMetadata: [undefined],
    },
    {
      name: '',
      users: [
        getTestBusiness({
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
            },
          },
          savedPaymentDetails: [
            {
              method: 'ACH',
              accountNumber: 'DE19500105178788668900012',
              bankName: 'Bank 1',
            },
          ],
        }),
        getTestBusiness({
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name 2',
            },
          },
          savedPaymentDetails: [
            {
              method: 'SWIFT',
              accountNumber: 'DE1950010517878863123123',
              bankName: 'Bank 3',
            },
          ],
        }),
      ],
      expectetRuleHitMetadata: [
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Bank 1',
              iban: 'DE19500105178788668900012',
              searchId: 'test-search-id',
              hitContext: expect.any(Object),
            },
          ],
        },
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Bank 3',
              iban: 'DE1950010517878863123123',
              searchId: 'test-search-id',
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

describe('Check for consumer user', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-32',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
        ruleStages: ['INITIAL', 'UPDATE', 'ONGOING'],
        fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
      } as SanctionsBankUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestUser({
          savedPaymentDetails: [
            {
              method: 'ACH',
              accountNumber: 'DE19500105178788668900012',
              bankName: 'Bank 1',
            },
          ],
        }),
        getTestUser({
          savedPaymentDetails: [
            {
              method: 'IBAN',
              IBAN: 'DE19500105178788668945',
            },
          ],
        }),
      ],
      expectetRuleHitMetadata: [
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Bank 1',
              iban: 'DE19500105178788668900012',
              searchId: 'test-search-id',
              hitContext: expect.any(Object),
            },
          ],
        },
        undefined,
      ],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})

describe('Skip if ongoing screening mode if on but ongoingScreening is false', () => {
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-32',
      defaultParameters: {
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
        ruleStages: ['INITIAL', 'UPDATE', 'ONGOING'],
        fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
        ongoingScreening: false,
      } as SanctionsBankUserRuleParameters,
    },
  ])

  describe.each<UserRuleTestCase>([
    {
      name: '',
      users: [
        getTestBusiness({
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
            },
          },
          savedPaymentDetails: [
            {
              method: 'IBAN',
              IBAN: 'DE19500105178788668945',
            },
          ],
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
