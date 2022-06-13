import { CardIssuedCountryRuleParameters } from '../card-issued-country'
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
    ruleImplementationName: 'card-issued-country',
    defaultParameters: {
      allowedCountries: ['DE', 'IN'],
    } as CardIssuedCountryRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'card issued country in the whitelist - not hit',
    transactions: [
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardIssuedCountry: 'DE',
        },
      }),
    ],
    expectedHits: [false],
  },
  {
    name: 'card issued country not in the whitelist - hit',
    transactions: [
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardIssuedCountry: 'TW',
        },
      }),
    ],
    expectedHits: [true],
  },
  {
    name: 'non-card origin payment - not hit',
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
    name: 'missing origin payment details - not hit',
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
