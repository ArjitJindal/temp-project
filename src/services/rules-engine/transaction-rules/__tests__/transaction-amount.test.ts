import dayjs from 'dayjs'
import { TransactionAmountRuleParameters } from '../transaction-amount'
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
    ruleImplementationName: 'transaction-amount',
    defaultParameters: {
      transactionAmountThreshold: { EUR: 1000 },
      ageRange: { minAge: 18, maxAge: 25 },
    } as TransactionAmountRuleParameters,
    defaultAction: 'FLAG',
  },
])

const user1DateOfBirth = dayjs().subtract(20, 'years')
const user2DateOfBirth = dayjs().subtract(40, 'years')

setUpConsumerUsersHooks(TEST_TENANT_ID, [
  getTestUser({
    userId: '1',
    userDetails: {
      name: {
        firstName: '1',
      },
      dateOfBirth: user1DateOfBirth.format('YYYY-MM-DD'),
    },
  }),
  getTestUser({
    userId: '2',
    userDetails: {
      name: {
        firstName: '2',
      },
      dateOfBirth: user2DateOfBirth.format('YYYY-MM-DD'),
    },
  }),
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'User in the target age range AND too big transaction amount - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedActions: ['FLAG'],
  },
  {
    name: 'User in the target age range AND too big transaction amount (currency not in the rule params) - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'USD',
        },
      }),
    ],
    expectedActions: ['FLAG'],
  },
  {
    name: 'User in the target age range AND normal transaction amount - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedActions: ['ALLOW'],
  },
  {
    name: 'User not in the target range AND too big transaction amount - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedActions: ['ALLOW'],
  },
  {
    name: 'User not in the target range AND normal transaction amount - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '2',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedActions: ['ALLOW'],
  },
  {
    name: 'Missing sender user ID - not hit',
    transactions: [
      getTestTransaction({
        originUserId: undefined,
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
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
