import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
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
