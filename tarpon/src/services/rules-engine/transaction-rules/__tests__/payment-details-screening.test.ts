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
import { SanctionsService } from '@/services/sanctions'

dynamoDbSetupHook()

withFeatureHook(['SANCTIONS'])

const TEST_SANCTIONS_HITS = [
  'Vladimir Putin',
  'Putin Mikhail Evgenievich',
  'Baran Ozkan',
]
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
      name: 'Optional parameter transactionThreshold',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'Vladimir Putin',
            },
            cardFingerprint: 'test-card-fingerprint-id-1',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 100,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          originPaymentDetails: {
            method: 'CARD',
            nameOnCard: {
              firstName: 'Mohammad Ijaz Safarash Ali',
            },
            cardFingerprint: 'test-card-fingerprint-id-2',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 1000,
          },
        }),
      ],
      expectedHits: [true, false],
    },
  ])('', ({ transactions, expectedHits }) => {
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        id: 'R-170',
        ruleImplementationName: 'payment-details-screening',
        defaultParameters: {
          screeningFields: ['NAME'],
          screeningTypes: ['SANCTIONS', 'PEP', 'ADVERSE_MEDIA'],
          fuzziness: 50,
          transactionAmountThreshold: {
            INR: 1,
          },
          fuzzinessSetting: 'LEVENSHTEIN_DISTANCE_DEFAULT',
        } as PaymentDetailsScreeningRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      'R-170 Payment Details Screening Rule',
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})
