import dayjs from 'dayjs'
import { TransactionsVolumeRuleParameters } from '../transactions-volume'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TRANSACTION_AMOUNT_100 = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

dynamoDbSetupHook()

describe('Core logic', () => {
  const TEST_HIT_TRANSACTIONS = [
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
    TransactionRuleTestCase<Partial<TransactionsVolumeRuleParameters>>
  >([
    {
      name: 'Sender: all, Receiver: all',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'FLAG', 'FLAG', 'FLAG'],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'all',
        transactionVolumeThreshold: {
          EUR: 201,
        },
      },
    },
    {
      name: 'Sender: sending, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'ALLOW'],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
        transactionVolumeThreshold: {
          EUR: 300,
        },
      },
    },
    {
      name: 'Sender: all, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'FLAG', 'FLAG', 'ALLOW'],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'none',
        transactionVolumeThreshold: {
          EUR: 300,
        },
      },
    },
    {
      name: 'Sender: none, Receiver: receiving',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW', 'ALLOW', 'ALLOW', 'FLAG'],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'receiving',
        transactionVolumeThreshold: {
          EUR: 300,
        },
      },
    },
    {
      name: 'Sender: none, Receiver: all',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'FLAG', 'FLAG'],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'all',
        transactionVolumeThreshold: {
          EUR: 300,
        },
      },
    },
  ])('', ({ name, transactions, expectedActions, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume',
        defaultParameters: {
          timeWindowInSeconds: 3600,
          ...ruleParams,
        } as TransactionsVolumeRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedActions
    )
  })
})

describe('Transaction State', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-volume',
      defaultParameters: {
        timeWindowInSeconds: 3600,
        checkSender: 'all',
        checkReceiver: 'all',
        transactionVolumeThreshold: {
          EUR: 300,
        },
        transactionState: 'SUCCESSFUL',
      } as TransactionsVolumeRuleParameters,
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Skip transactions with non-target state',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          transactionState: 'DECLINED',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-4',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-5',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW', 'FLAG'],
    },
  ])('', ({ name, transactions, expectedActions }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedActions
    )
  })
})
