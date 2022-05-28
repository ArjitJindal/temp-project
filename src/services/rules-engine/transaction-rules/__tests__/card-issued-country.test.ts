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
    expectedActions: ['ALLOW'],
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
    expectedActions: ['FLAG'],
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
    expectedActions: ['ALLOW'],
  },
  {
    name: 'missing origin payment details - not hit',
    transactions: [
      getTestTransaction({
        originPaymentDetails: undefined,
      }),
    ],
    expectedActions: ['ALLOW'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedActions
  )
})
