import { TransactionsVolumeQuantilesRuleParameters } from '../transactions-volume-quantiles'
import { getTransactionRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

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

  describe('R-69 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume-quantiles',
        defaultParameters: {
          timeWindowInSeconds: 3600,
          ...{
            checkSender: 'all',
            checkReceiver: 'all',
            transactionVolumeThresholds: {
              MONTHLY: {
                EUR: 201,
              },
            },
          },
        } as TransactionsVolumeQuantilesRuleParameters,
      },
    ])

    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      TEST_TRANSACTIONS,
      {
        descriptionTemplate:
          getTransactionRuleByRuleId('R-69').descriptionTemplate,
      },
      [
        null,
        null,
        'Sender is spending 99.00 EUR above their expected amount of 201.00 EUR',
        'Sender is spending 199.00 EUR above their expected amount of 201.00 EUR',
        'Sender is spending 299.00 EUR above their expected amount of 201.00 EUR',
        'Receiver is receiving 299.00 EUR above their expected amount of 201.00 EUR',
      ]
    )
  })

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
