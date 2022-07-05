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
    expectedHits: [true],
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
    expectedHits: [true],
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
    expectedHits: [false],
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
    expectedHits: [false],
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
    expectedHits: [false],
  },
  {
    name: 'Missing sender user ID - hit',
    transactions: [
      getTestTransaction({
        originUserId: undefined,
        originAmountDetails: {
          transactionAmount: 10000,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [true],
  },
  {
    name: 'Undefined age range, above threshold- hit',
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
    name: 'Undefined age range, below threshold - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 10,
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

describe('Optional parameters - Payment Method', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-amount',
      defaultParameters: {
        transactionAmountThreshold: { EUR: 1000 },
        paymentMethod: 'CARD',
      } as TransactionAmountRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Transaction amount above threshold - hit',
      transactions: [
        getTestTransaction({
          originUserId: '2',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'EUR',
          },
          originPaymentDetails: {
            method: 'CARD',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Transaction amount below threshold - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '3',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
          originPaymentDetails: {
            method: 'CARD',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount above threshold with different payment method - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'EUR',
          },
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'savings',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount below threshold with different payment method - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '4',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'savings',
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
})

describe('Optional parameters - Payment Type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-amount',
      defaultParameters: {
        transactionAmountThreshold: { EUR: 1000 },
        transactionType: 'Withdrawal',
      } as TransactionAmountRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Transaction amount above threshold - hit',
      transactions: [
        getTestTransaction({
          originUserId: '5',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'EUR',
          },
          type: 'Withdrawal',
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Transaction amount below threshold - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
          type: 'Withdrawal',
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount below threshold with different payment type - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
          type: 'Deposit',
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount above threshold with different payment type - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'EUR',
          },
          type: 'Deposit',
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

describe('Optional parameters - User Type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-amount',
      defaultParameters: {
        transactionAmountThreshold: { EUR: 1000 },
        userType: 'CONSUMER',
      } as TransactionAmountRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  setUpConsumerUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1' }),
    getTestUser({ userId: '2' }),
    getTestUser({ userId: '3' }),
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Transaction amount above threshold - hit',
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
      name: 'Transaction amount below threshold - not hit',
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
      name: 'Transaction amount below threshold with different user type - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount above threshold with different user type - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5',
          originAmountDetails: {
            transactionAmount: 10000,
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
})
