import { BlacklistCardIssuedCountryRuleParameters } from '../blacklist-card-issued-country'
import { getRuleByRuleId } from '../library'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
  ruleVariantsTest,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

ruleVariantsTest({ v8: true, aggregation: false }, () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'blacklist-card-issued-country',
      defaultParameters: {
        blacklistedCountries: ['DE', 'IN'],
      } as BlacklistCardIssuedCountryRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe('R-22 description formatting', () => {
    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            cardIssuedCountry: 'DE',
          },
          destinationPaymentDetails: undefined,
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-22').descriptionTemplate,
      },
      ['Sender’s card is issued from Germany, a blacklisted country.']
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Card issued country in the blacklist - hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            cardIssuedCountry: 'DE',
          },
          destinationPaymentDetails: undefined,
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Card issued country not in the blacklist - not hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            cardIssuedCountry: 'TW',
          },
          destinationPaymentDetails: undefined,
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Empty Card issued country - not hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'CARD',
            cardIssuedCountry: undefined,
          },
          destinationPaymentDetails: undefined,
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Missing origin payment details - not hit',
      transactions: [
        getTestTransaction({
          originPaymentDetails: undefined,
          destinationPaymentDetails: undefined,
        }),
      ],
      expectedHits: [false],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})
