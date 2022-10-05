import { HighUnsuccessfullStateRateParameters } from '../high-unsuccessfull-state-rate'
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

const TEST_TRANSACTION_AMOUNT_100 = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

dynamoDbSetupHook()

function getDefaultParams(): HighUnsuccessfullStateRateParameters {
  return {
    timeWindow: {
      granularity: 'day',
      units: 1,
      rollingBasis: true,
    },
    threshold: 100,
    transactionState: 'REFUNDED',
    checkSender: 'all',
    checkReceiver: 'all',
    minimumTransactions: 1,
  }
}

describe('Description formatting', () => {
  describe('R-125 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const now = dayjs('2022-01-01T00:00:00.000Z')

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-unsuccessfull-state-rate',
        defaultParameters: {
          ...getDefaultParams(),
          minimumTransactions: 1,
          threshold: 0.99,
        },
      },
    ])

    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      {
        descriptionTemplate:
          getTransactionRuleByRuleId('R-125').descriptionTemplate,
      },
      [
        'Sender has more than 99.00% of all transactions in a “REFUNDED” state within 1 day. The rule is activated after the user initiates 1 number of transactions in total.',
      ]
    )
  })
})

describe('Core login', () => {
  const now = dayjs('2022-01-01T00:00:00.000Z')

  const defaultParams = getDefaultParams()

  describe.each<
    TransactionRuleTestCase<Partial<HighUnsuccessfullStateRateParameters>>
  >([
    {
      name: 'Basic case',
      ruleParams: {
        minimumTransactions: 3,
        threshold: 0.32,
      },
      transactions: [
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.subtract(2, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.subtract(1, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [false, false, true],
    },
    {
      name: 'Single transaction gives 100%',
      ruleParams: {
        minimumTransactions: 1,
        threshold: 0.99,
      },
      transactions: [
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [true],
    },
    {
      name: `Transactions outside of time window doesn't count`,
      ruleParams: {
        minimumTransactions: 2,
        threshold: 0,
      },
      transactions: [
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [false, false],
    },
    {
      name: `Transactions of wrong type doesn't count`,
      ruleParams: {
        minimumTransactions: 2,
        threshold: 0,
        transactionTypes: ['DEPOSIT'],
      },
      transactions: [
        getTestTransaction({
          type: 'WITHDRAWAL',
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(2, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(1, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [false, false, true],
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-unsuccessfull-state-rate',
        defaultParameters: {
          ...defaultParams,
          ...ruleParams,
        },
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

describe('Different directions', () => {
  const now = dayjs('2022-01-01T00:00:00.000Z')

  const defaultParams = getDefaultParams()

  describe.each<
    TransactionRuleTestCase<Partial<HighUnsuccessfullStateRateParameters>>
  >([
    {
      name: 'Sender -> sending',
      transactions: [
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(4, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '333',
          timestamp: now.subtract(3, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '222',
          destinationUserId: '111',
          timestamp: now.subtract(2, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          originUserId: '222',
          destinationUserId: '111',
          timestamp: now.subtract(1, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          transactionId: 'test',
          originUserId: '111',
          destinationUserId: '444',
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [false, false, false, false, true],
      ruleParams: {
        threshold: 0.1,
        checkSender: 'sending',
        checkReceiver: 'none',
        minimumTransactions: 3,
      },
    },
    {
      name: 'Sender -> all',
      transactions: [
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(4, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '333',
          timestamp: now.subtract(3, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '222',
          destinationUserId: '111',
          timestamp: now.subtract(2, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          originUserId: '222',
          destinationUserId: '111',
          timestamp: now.subtract(1, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          transactionId: 'test',
          originUserId: '111',
          destinationUserId: '444',
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [false, false, false, true, true],
      ruleParams: {
        threshold: 0.1,
        checkSender: 'all',
        checkReceiver: 'none',
        minimumTransactions: 3,
      },
    },
    {
      name: 'Receiver -> receiving',
      transactions: [
        getTestTransaction({
          originUserId: '222',
          destinationUserId: '111',
          timestamp: now.subtract(4, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '333',
          destinationUserId: '111',
          timestamp: now.subtract(3, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(2, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(1, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          transactionId: 'test',
          originUserId: '444',
          destinationUserId: '111',
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [false, false, false, false, true],
      ruleParams: {
        threshold: 0.1,
        checkSender: 'none',
        checkReceiver: 'receiving',
        minimumTransactions: 3,
      },
    },
    {
      name: 'Receiver -> all',
      transactions: [
        getTestTransaction({
          originUserId: '222',
          destinationUserId: '111',
          timestamp: now.subtract(4, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '333',
          destinationUserId: '111',
          timestamp: now.subtract(3, 'hour').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(2, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          originUserId: '111',
          destinationUserId: '222',
          timestamp: now.subtract(1, 'hour').valueOf(),
          transactionState: 'REFUNDED',
        }),
        getTestTransaction({
          transactionId: 'test',
          originUserId: '444',
          destinationUserId: '111',
          timestamp: now.valueOf(),
          transactionState: 'REFUNDED',
        }),
      ],
      expectedHits: [false, false, false, true, true],
      ruleParams: {
        threshold: 0.1,
        checkSender: 'none',
        checkReceiver: 'all',
        minimumTransactions: 3,
      },
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-unsuccessfull-state-rate',
        defaultParameters: {
          ...defaultParams,
          ...ruleParams,
        },
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
