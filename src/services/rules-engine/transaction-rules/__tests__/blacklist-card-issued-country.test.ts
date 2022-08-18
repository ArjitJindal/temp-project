import { BlacklistCardIssuedCountryRuleParameters } from '../blacklist-card-issued-country'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'blacklist-card-issued-country',
    defaultParameters: {
      blacklistedCountries: ['DE', 'IN'],
    } as unknown as BlacklistCardIssuedCountryRuleParameters,
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
      }),
    ],
    {
      descriptionTemplate: `{{ if-sender 'Sender’s' 'Receiver’s' }} card is issued from {{ if-sender origin.payment.country destination.payment.country }}, a blacklisted country`,
    },
    ['Sender’s card is issued from Germany, a blacklisted country']
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
      }),
    ],
    expectedHits: [false],
  },
  {
    name: 'Non-card origin payment - not hit',
    transactions: [
      getTestTransaction({
        originPaymentDetails: {
          method: 'GENERIC_BANK_ACCOUNT',
          accountNumber: '123',
        },
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
      }),
    ],
    expectedHits: [false],
  },
  {
    name: 'Missing origin payment details - not hit',
    transactions: [
      getTestTransaction({
        originPaymentDetails: undefined,
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
