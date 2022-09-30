import { getTransactionRuleByRuleId } from '../library'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'transaction-amount-user-limit',
    defaultAction: 'FLAG',
  },
])

setUpConsumerUsersHooks(TEST_TENANT_ID, [
  getTestUser({
    userId: '1',
    transactionLimits: {
      maximumTransactionLimit: { amountCurrency: 'EUR', amountValue: 1000 },
    },
  }),
  getTestUser({
    userId: '2',
  }),
])

describe('R-99 description formatting', () => {
  testRuleDescriptionFormatting(
    'basic case',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-99').descriptionTemplate,
    },
    [
      'Sender sent a transaction amount of 10000.00 EUR more than the limit of 1000.00 EUR',
    ]
  )
})
describe.each<TransactionRuleTestCase>([
  {
    name: 'Transaction amount exceeds user specific limit - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [true],
  },
  {
    name: 'Transaction amount exceeds user specific limit (different currency) - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'USD',
        },
      }),
    ],
    expectedHits: [true],
  },
  {
    name: "Transaction amount doesn't exceed user specific limit - not hit",
    transactions: [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [false],
  },
  {
    name: 'User has no transaction limit - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 100000000000,
          transactionCurrency: 'EUR',
        },
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
