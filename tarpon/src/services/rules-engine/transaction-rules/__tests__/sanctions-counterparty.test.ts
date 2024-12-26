import { PaymentDetailsScreeningRuleParameters } from '../payment-details-screening-base'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import {
  MOCK_CA_SEARCH_NO_HIT_RESPONSE,
  MOCK_CA_SEARCH_RESPONSE,
} from '@/test-utils/resources/mock-ca-search-response'
import {
  TransactionRuleTestCase,
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { SanctionsService } from '@/services/sanctions'

process.env.IBAN_API_KEY = 'fake'

dynamoDbSetupHook()

withFeatureHook(['SANCTIONS', 'IBAN_RESOLUTION'])

const TEST_SANCTIONS_HITS = ['Vladimir Putin', 'Bank 1', 'Baran Ozkan']
const TEST_TENANT_ID = getTestTenantId()

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

ruleVariantsTest({ aggregation: false }, () => {
  describe.each<TransactionRuleTestCase>([
    {
      name: 'IBAN Bank Resolution Tests',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'AL35202111090000000001234567',
            name: 'Vladimir Putin',
            bankName: 'Bank 100',
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'AL35202111090000000001234567',
            name: 'Vladimir Putin',
          },
        }),
      ],
      expectedHits: [true, true],
    },
  ])('', ({ transactions, expectedHits }) => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-169',
        ruleImplementationName: 'sanctions-counterparty',
        defaultParameters: {
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          resolveIban: true,
        } as PaymentDetailsScreeningRuleParameters,
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: 'U-1',
      }),
    ])

    createTransactionRuleTestCase(
      'R-169 Sanctions Counterparty Rule IBAN Test Case 1',
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Card Details Resolution Tests',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'Baran',
              lastName: 'Ozkan',
            },
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'Sergey',
              lastName: 'Brin',
            },
          },
        }),
      ],
      expectedHits: [true, false],
    },
  ])('', ({ transactions, expectedHits }) => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-169',
        ruleImplementationName: 'sanctions-counterparty',
        defaultParameters: {
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          resolveIban: false,
        } as PaymentDetailsScreeningRuleParameters,
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: 'U-1',
      }),
    ])

    createTransactionRuleTestCase(
      'R-169 Sanctions Counterparty Rule Card Details Test Case 1',
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'IBAN Bank Resolution Tests with ACH Details',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'ACH',
            name: 'Vladimir Putin',
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            accountNumber: 'AD1400080001001234567890',
            name: 'Sergey Brin',
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'AL35202111090000000001234567',
            name: 'Vladimir Putin',
          },
        }),
        getTestTransaction({
          originUserId: 'U-1',
          destinationUserId: 'U-5',
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'AL35202111090000000001234567',
            name: 'Vladimir Putin',
          },
        }),
      ],
      expectedHits: [true, false, true, false],
    },
  ])('', ({ transactions, expectedHits }) => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-169',
        ruleImplementationName: 'sanctions-counterparty',
        defaultParameters: {
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          resolveIban: true,
        } as PaymentDetailsScreeningRuleParameters,
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: 'U-1',
      }),
      getTestUser({
        userId: 'U-5',
      }),
    ])

    createTransactionRuleTestCase(
      'R-169 Sanctions Counterparty Rule IBAN Test Case 2',
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Optional parameter transactionThreshold',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'AL35202111090000000001234567',
            name: 'Vladimir Putin',
            bankName: 'Bank 100',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 100,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'U-1',
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: 'AL35202111090000000001234567',
            name: 'Vladimir Putin',
            bankName: 'Bank 100',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 1000,
          },
        }),
      ],
      expectedHits: [false, true],
    },
  ])('', ({ transactions, expectedHits }) => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-169',
        ruleImplementationName: 'sanctions-counterparty',
        defaultParameters: {
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          resolveIban: true,
          transactionAmountThreshold: {
            EUR: 1000,
          },
        } as PaymentDetailsScreeningRuleParameters,
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: 'U-1',
      }),
    ])

    createTransactionRuleTestCase(
      'R-169 Sanctions Counterparty Rule Optional Parameter Transaction Threshold',
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})
