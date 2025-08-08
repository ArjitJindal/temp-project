import { PaymentDetailsScreeningRuleParameters } from '../payment-details-screening-base'
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

dynamoDbSetupHook()

withFeatureHook(['SANCTIONS'])

const TEST_SANCTIONS_HITS = ['Vladimir Putin', 'Bank 1', 'Baran Ozkan']
const TEST_TENANT_ID = getTestTenantId()

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
          screeningFields: ['NAME'],
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          ruleStages: ['INITIAL', 'UPDATE'],
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
          screeningFields: ['NAME'],
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          ruleStages: ['INITIAL', 'UPDATE'],
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
          screeningFields: ['NAME'],
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          ruleStages: ['INITIAL', 'UPDATE'],
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
          screeningFields: ['NAME'],
          screeningTypes: ['SANCTIONS'],
          fuzziness: 50,
          fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
          screeningProfileId: 'default',
          transactionAmountThreshold: {
            EUR: 1000,
          },
          ruleStages: ['INITIAL', 'UPDATE'],
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
