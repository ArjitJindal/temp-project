import { HighUnsuccessfullStateRateParameters } from '../high-unsuccessfull-state-rate'
import { getRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testAggregationRebuild,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
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
    transactionStates: ['REFUNDED'],
    checkSender: 'all',
    checkReceiver: 'all',
    minimumTransactions: 1,
  }
}

ruleVariantsTest({ aggregation: true }, () => {
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
            threshold: 99,
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
          descriptionTemplate: getRuleByRuleId('R-125').descriptionTemplate,
        },
        [
          'Sender has more than 99.00% of all transactions in “REFUNDED” states within 1 day. The rule is activated after the user initiates 1 number of transactions in total. Receiver has more than 99.00% of all transactions in “REFUNDED” states within 1 day. The rule is activated after the user initiates 1 number of transactions in total.',
        ]
      )
    })
  })

  describe('Core logic', () => {
    const now = dayjs('2022-01-01T00:00:00.000Z')

    const defaultParams = getDefaultParams()

    describe.each<
      TransactionRuleTestCase<Partial<HighUnsuccessfullStateRateParameters>>
    >([
      {
        name: 'Basic case',
        ruleParams: {
          minimumTransactions: 3,
          threshold: 32,
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
          threshold: 99,
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
          threshold: 10,
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
          threshold: 10,
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
          threshold: 10,
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
          threshold: 10,
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
})

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'high-unsuccessfull-state-rate',
    defaultParameters: getDefaultParams(),
  },
  [
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
      transactionState: 'SUCCESSFUL',
    }),
    getTestTransaction({
      originUserId: '2',
      destinationUserId: '1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T01:30:00.000Z').valueOf(),
      transactionState: 'REFUNDED',
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T01:40:00.000Z').valueOf(),
      transactionState: 'SUCCESSFUL',
    }),
    getTestTransaction({
      originUserId: '2',
      destinationUserId: '1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T02:30:00.000Z').valueOf(),
      transactionState: 'REFUNDED',
    }),
  ],
  {
    origin: [
      {
        filteredSendingCount: 1,
        allReceivingCount: 2,
        allSendingCount: 1,
        filteredReceivingCount: 2,
        hour: '2022010101',
      },
      {
        filteredSendingCount: 1,
        allSendingCount: 1,
        hour: '2022010102',
      },
    ],
    destination: [
      {
        filteredSendingCount: 2,
        allReceivingCount: 1,
        allSendingCount: 2,
        filteredReceivingCount: 1,
        hour: '2022010101',
      },
      {
        allReceivingCount: 1,
        filteredReceivingCount: 1,
        hour: '2022010102',
      },
    ],
  }
)
