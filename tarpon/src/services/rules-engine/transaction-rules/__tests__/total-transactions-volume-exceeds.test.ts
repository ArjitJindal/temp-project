import { TransactionVolumeExceedsTwoPeriodsRuleParameters } from '../total-transactions-volume-exceeds'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  TransactionRuleTestCase,
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testAggregationRebuild,
} from '@/test-utils/rule-test-utils'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_AMOUNT_500: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 500,
}

dynamoDbSetupHook()

function getDefaultParams(): TransactionVolumeExceedsTwoPeriodsRuleParameters {
  return {
    period1: {
      granularity: 'day',
      units: 1,
      rollingBasis: true,
    },
    period2: {
      granularity: 'day',
      units: 2,
      rollingBasis: true,
    },
    multiplierThreshold: {
      currency: 'EUR',
      value: 200,
    },
    checkSender: 'all',
    checkReceiver: 'all',
    excludePeriod1: true,
  }
}

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  const defaultParams = getDefaultParams()

  describe('Core logic', () => {
    const now = dayjs('2021-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionVolumeExceedsTwoPeriodsRuleParameters>
      >
    >([
      {
        name: 'No transactions within periods',
        transactions: [],
        expectedHits: [],
        ruleParams: getDefaultParams(),
      },
      {
        name: 'Multiple transactions which keep the total volume below threshold',
        transactions: [
          getTestTransaction({
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Multiple transactions which keep the total volume high enough',
        transactions: [
          getTestTransaction({
            transactionId: 'transaction1',
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: 'transaction2',
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: 'transaction3',
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_500,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
    ])('Rule variants', ({ name, ruleParams, transactions, expectedHits }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'total-transactions-volume-exceeds',
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
    ruleImplementationName: 'total-transactions-volume-exceeds',
    defaultParameters: getDefaultParams(),
  },
  [
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '2',
      destinationUserId: '1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_500,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_500,
      timestamp: dayjs('2022-01-01T10:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      {
        receivingCount: 1,
        sendingCount: 1,
        sendingAmount: 100,
        receivingAmount: 100,
        hour: '2022010100',
      },
      {
        sendingAmount: 500,
        sendingCount: 1,
        hour: '2022010110',
      },
    ],
    destination: [
      {
        receivingCount: 1,
        sendingCount: 1,
        sendingAmount: 100,
        receivingAmount: 100,
        hour: '2022010100',
      },
      {
        receivingCount: 1,
        receivingAmount: 500,
        hour: '2022010110',
      },
    ],
  }
)
