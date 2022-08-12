import { TransactionsVolumeQuantilesRuleParameters } from '../transactions-volume-quantiles'
import dayjs from '@/utils/dayjs'
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

dynamoDbSetupHook()

const TEST_TRANSACTION_AMOUNT_100 = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

describe('Sender/Receiver Parameters', () => {
  const TEST_TRANSACTIONS = [
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-3',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-4',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
  ]

  describe.each<
    TransactionRuleTestCase<Partial<TransactionsVolumeQuantilesRuleParameters>>
  >([
    {
      name: 'Sender: all, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, true, true, true],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 201,
          },
        },
      },
    },
    {
      name: 'Sender: sending, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, true, false, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
      },
    },
    {
      name: 'Sender: all, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, true, true, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
      },
    },
    {
      name: 'Sender: none, Receiver: receiving',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, false, false, true],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'receiving',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
      },
    },
    {
      name: 'Sender: none, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, false, true, true],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
      },
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume-quantiles',
        defaultParameters: {
          timeWindowInSeconds: 3600,
          ...ruleParams,
        } as TransactionsVolumeQuantilesRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Time Granularities', () => {
  describe.each<
    TransactionRuleTestCase<Partial<TransactionsVolumeQuantilesRuleParameters>>
  >([
    {
      name: 'Daily',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T23:59:59.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          DAILY: {
            EUR: 200,
          },
        },
      },
    },
    {
      name: 'Monthly',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-31T23:59:59.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-02-01T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 200,
          },
        },
      },
    },
    {
      name: 'Yearly',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-12-31T23:59:59.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2023-01-01T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          YEARLY: {
            EUR: 200,
          },
        },
      },
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume-quantiles',
        defaultParameters: {
          timeWindowInSeconds: 3600,
          ...ruleParams,
        } as TransactionsVolumeQuantilesRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('User Check', () => {
  const TEST_TRANSACTIONS = [
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-3',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-4',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
  ]

  describe.each<
    TransactionRuleTestCase<Partial<TransactionsVolumeQuantilesRuleParameters>>
  >([
    {
      name: 'Sender: all, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, true, false, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 201,
          },
        },
        userType: 'CONSUMER',
      },
    },
    {
      name: 'Sender: sending, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, false, false, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        userType: 'BUSINESS',
      },
    },
    {
      name: 'Sender: all, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, true, false, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        userType: 'CONSUMER',
      },
    },
    {
      name: 'Sender: none, Receiver: receiving',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, false, false, false],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'receiving',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        userType: 'CONSUMER',
      },
    },
    {
      name: 'Sender: none, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, false, true, true],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        userType: 'BUSINESS',
      },
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume-quantiles',
        defaultParameters: {
          timeWindowInSeconds: 3600,
          ...ruleParams,
        } as TransactionsVolumeQuantilesRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )

    setUpConsumerUsersHooks(TEST_TENANT_ID, [
      getTestUser({ userId: '1-1' }),
      getTestUser({ userId: '2-1' }),
      getTestUser({ userId: '3-1' }),
    ])
  })
})

describe('Transaction type', () => {
  const TEST_TRANSACTIONS = [
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-1',
      destinationUserId: '1-3',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'WITHDRAWAL',
      originUserId: '1-4',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
  ]

  describe.each<
    TransactionRuleTestCase<Partial<TransactionsVolumeQuantilesRuleParameters>>
  >([
    {
      name: 'Sender: all, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, true, true, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 201,
          },
        },
        transactionType: 'DEPOSIT',
      },
    },
    {
      name: 'Sender: sending, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, true, false, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        transactionType: 'DEPOSIT',
      },
    },
    {
      name: 'Sender: all, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, true, true, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        transactionType: 'DEPOSIT',
      },
    },
    {
      name: 'Sender: none, Receiver: receiving',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, false, false, false],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'receiving',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        transactionType: 'DEPOSIT',
      },
    },
    {
      name: 'Sender: none, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, false, false, true],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        transactionType: 'WITHDRAWAL',
      },
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume-quantiles',
        defaultParameters: {
          timeWindowInSeconds: 3600,
          ...ruleParams,
        } as TransactionsVolumeQuantilesRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Payment Method', () => {
  const TEST_TRANSACTIONS = [
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      originPaymentDetails: {
        method: 'CARD',
      },
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      originPaymentDetails: {
        method: 'CARD',
      },
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-1',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      originPaymentDetails: {
        method: 'WALLET',
        walletType: 'savings',
      },
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-1',
      destinationUserId: '1-3',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      originPaymentDetails: {
        method: 'CARD',
      },
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'DEPOSIT',
      originUserId: '1-2',
      destinationUserId: '1-1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      originPaymentDetails: {
        method: 'CARD',
      },
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
    getTestTransaction({
      type: 'WITHDRAWAL',
      originUserId: '1-4',
      destinationUserId: '1-2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      originPaymentDetails: {
        method: 'WALLET',
        walletType: 'savings',
      },
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
    }),
  ]

  describe.each<
    TransactionRuleTestCase<Partial<TransactionsVolumeQuantilesRuleParameters>>
  >([
    {
      name: 'Sender: all, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, true, true, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 201,
          },
        },
        paymentMethod: 'CARD',
      },
    },
    {
      name: 'Sender: sending, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, true, false, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        paymentMethod: 'CARD',
      },
    },
    {
      name: 'Sender: all, Receiver: none',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, false, false, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'none',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        paymentMethod: 'WALLET',
      },
    },
    {
      name: 'Sender: none, Receiver: receiving',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, false, false, false, false],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'receiving',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        paymentMethod: 'CARD',
      },
    },
    {
      name: 'Sender: none, Receiver: all',
      transactions: TEST_TRANSACTIONS,
      expectedHits: [false, false, true, false, false, true],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'all',
        transactionVolumeThresholds: {
          MONTHLY: {
            EUR: 300,
          },
        },
        paymentMethod: 'WALLET',
      },
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume-quantiles',
        defaultParameters: {
          timeWindowInSeconds: 3600,
          ...ruleParams,
        } as TransactionsVolumeQuantilesRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})
