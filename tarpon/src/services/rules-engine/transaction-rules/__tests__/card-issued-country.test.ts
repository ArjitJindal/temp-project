import { CardIssuedCountryRuleParameters } from '../card-issued-country'
import { getRuleByRuleId } from '../library'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
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

describe('R-114 description formatting', () => {
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
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardIssuedCountry: 'TW',
        },
      }),
      getTestTransaction({
        originPaymentDetails: {
          method: 'CARD',
          cardIssuedCountry: 'RU',
        },
      }),
    ],
    {
      descriptionTemplate: getRuleByRuleId('R-114').descriptionTemplate,
    },
    [
      null,
      'Sender’s card country Taiwan is not whitelisted.',
      'Sender’s card country Russian Federation is not whitelisted.',
    ]
  )
})

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
