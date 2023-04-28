import { SanctionsBankUserRuleParameters } from '../sanctions-bank-name'
import { getTestBusiness } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import {
  setUpRulesHooks,
  createUserRuleTestCase,
  UserRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import {
  MOCK_CA_SEARCH_NO_HIT_RESPONSE,
  MOCK_CA_SEARCH_RESPONSE,
} from '@/test-utils/resources/mock-ca-search-response'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'

const TEST_IBAN_BANK_NAME_MAPPING: { [key: string]: IBANDetails } = {
  AL35202111090000000001234567: {
    method: 'IBAN',
    IBAN: 'AL35202111090000000001234567',
    bankName: 'Bank 1',
  },
  AL35202111090000000001234568: {
    method: 'IBAN',
    IBAN: 'AL35202111090000000001234568',
    bankName: 'Bank 1',
  },
  AD1400080001001234567890: {
    method: 'IBAN',
    IBAN: 'AD1400080001001234567890',
    bankName: 'Bank 2',
  },
  AD1400080001001234567891: {
    method: 'IBAN',
    IBAN: 'AD1400080001001234567891',
    bankName: 'Bank 3',
  },
}

const TEST_TENANT_ID = getTestTenantId()

jest.mock('@/services/iban.com', () => {
  const originalModule = jest.requireActual<
    typeof import('@/services/iban.com')
  >('@/services/iban.com')

  return {
    __esModule: true,
    ...originalModule,
    IBANService: jest.fn().mockImplementation(() => {
      return {
        resolveBankName: originalModule.IBANService.prototype.resolveBankName,
        tenantId: TEST_TENANT_ID,
        validateIBAN: jest.fn().mockImplementation((iban: string) => {
          return TEST_IBAN_BANK_NAME_MAPPING[iban]
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
              IBAN: 'AD1400080001001234567890',
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
              IBAN: 'AD1400080001001234567890',
              bankName: 'Bank 1',
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
              IBAN: 'AL35202111090000000001234567',
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
              IBAN: 'AL35202111090000000001234567',
            },
            {
              method: 'IBAN',
              IBAN: 'AL35202111090000000001234568',
            },
            {
              method: 'GENERIC_BANK_ACCOUNT',
              accountNumber: 'AD1400080001001234567891',
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
              name: 'Bank 1',
              searchId: 'test-search-id',
            },
          ],
        },
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Bank 1',
              searchId: 'test-search-id',
            },
          ],
        },
        {
          hitDirections: ['ORIGIN'],
          sanctionsDetails: [
            {
              name: 'Bank 1',
              searchId: 'test-search-id',
            },
            {
              name: 'Bank 3',
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
              IBAN: 'AL35202111090000000001234567',
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
