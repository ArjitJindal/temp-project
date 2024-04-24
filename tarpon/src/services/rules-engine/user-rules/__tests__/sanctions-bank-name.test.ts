import { SanctionsBankUserRuleParameters } from '../sanctions-bank-name'
import { getTestBusiness } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  setUpRulesHooks,
  createUserRuleTestCase,
  UserRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import {
  MOCK_CA_SEARCH_NO_HIT_RESPONSE,
  MOCK_CA_SEARCH_RESPONSE,
} from '@/test-utils/resources/mock-ca-search-response'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

process.env.IBAN_API_KEY = 'fake'

const TEST_IBAN_BANK_NAME_MAPPING: { [key: string]: IBANDetails } = {
  DE19500105178788668945: {
    method: 'IBAN',
    IBAN: 'DE19500105178788668945',
    bankName: 'Bank 1',
  },
  DE27500105174885852364: {
    method: 'IBAN',
    IBAN: 'DE27500105174885852364',
    bankName: 'Bank 1',
  },
  DE57500105176644695691: {
    method: 'IBAN',
    IBAN: 'DE57500105176644695691',
    bankName: 'Bank 2',
  },
  DE60500105171315276629: {
    method: 'IBAN',
    IBAN: 'DE60500105171315276629',
    bankName: 'Bank 3',
  },
}

const TEST_TENANT_ID = getTestTenantId()

jest.mock('@/services/iban', () => {
  const originalModule =
    jest.requireActual<typeof import('@/services/iban')>('@/services/iban')

  return {
    __esModule: true,
    ...originalModule,
    IBANService: jest.fn().mockImplementation(() => {
      return {
        resolveBankNames: originalModule.IBANService.prototype.resolveBankNames,
        initialize: originalModule.IBANService.prototype.initialize,
        initializeInternal:
          originalModule.IBANService.prototype.initializeInternal,
        tenantId: TEST_TENANT_ID,
        queryIban: jest.fn().mockImplementation((iban: string) => {
          return new Promise((resolve) =>
            resolve(TEST_IBAN_BANK_NAME_MAPPING[iban])
          )
        }),
      }
    }),
  }
})

const TEST_SANCTIONS_HITS = ['Bank 1', 'Bank 3']

jest.mock('@/services/sanctions', () => {
  return {
    SanctionsService: jest.fn().mockImplementation(() => {
      return {
        search: jest
          .fn()
          .mockImplementation((request: SanctionsSearchRequest) => {
            const rawComplyAdvantageResponse = TEST_SANCTIONS_HITS.includes(
              request.searchTerm
            )
              ? MOCK_CA_SEARCH_RESPONSE
              : MOCK_CA_SEARCH_NO_HIT_RESPONSE
            return {
              data: rawComplyAdvantageResponse.content.data.hits,
              searchId: 'test-search-id',
            }
          }),
      }
    }),
  }
})

dynamoDbSetupHook()
withFeatureHook(['IBAN_RESOLUTION'])

describe('IBAN resolution enabled', () => {
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-32',
      defaultParameters: {
        resolveIban: true,
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
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
              IBAN: 'DE57500105176644695691',
            },
          ],
        }),
        getTestBusiness({
          legalEntity: {
            companyGeneralDetails: {
              legalName: 'Company Name',
            },
          },
          savedPaymentDetails: [
            {
              method: 'IBAN',
              IBAN: 'DE57500105176644695691',
            },
          ],
        }),
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
            {
              method: 'IBAN',
              IBAN: 'DE27500105174885852364',
            },
            {
              method: 'GENERIC_BANK_ACCOUNT',
              accountNumber: 'DE60500105171315276629',
            },
          ],
        }),
      ],
      expectetRuleHitMetadata: [
        undefined,
        undefined,
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Bank 1',
              iban: 'DE19500105178788668945',
              searchId: 'test-search-id',
            },
          ],
        },
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Bank 1',
              iban: 'DE19500105178788668945',
              searchId: 'test-search-id',
            },
            {
              name: 'Bank 1',
              iban: 'DE27500105174885852364',
              searchId: 'test-search-id',
            },
            {
              name: 'Bank 3',
              iban: 'DE60500105171315276629',
              searchId: 'test-search-id',
            },
          ],
        },
      ],
    },
  ])('', ({ name, users, expectetRuleHitMetadata }) => {
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})

describe('IBAN resolution disabled', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-32',
      defaultParameters: {
        resolveIban: false,
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
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
    createUserRuleTestCase(name, TEST_TENANT_ID, users, expectetRuleHitMetadata)
  })
})

describe('Skip if ongoing screening mode if on but ongoingScreening is false', () => {
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      id: 'R-32',
      defaultParameters: {
        resolveIban: true,
        screeningTypes: ['SANCTIONS'],
        fuzziness: 0.5,
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
