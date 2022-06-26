import { BlacklistCardIssuedCountryRuleParameters } from '../blacklist-card-issued-country'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
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
