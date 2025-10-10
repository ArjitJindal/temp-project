import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testAggregationRebuild,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { TransactionsAverageAmountExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-amount-exceeded'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_AMOUNT_300: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 300,
}

dynamoDbSetupHook()

function getDefaultParams(): TransactionsAverageAmountExceededParameters {
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
      value: 100,
    },
    checkSender: 'all',
    checkReceiver: 'all',
  }
}

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  const defaultParams = getDefaultParams()

  describe('Core logic', () => {
    const now = dayjs('2022-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionsAverageAmountExceededParameters>
      >
    >([
      {
        name: 'No Transactions within the Periods',
        transactions: [],
        expectedHits: [],
        ruleParams: getDefaultParams(),
      },
      {
        name: 'Multiple transactions which keep the average the same do not trigger the rule',
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Last transaction increases average and triggers',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Check exclude mode',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false],
        ruleParams: {
          excludePeriod1: true,
        },
      },
      {
        name: 'Check exclude mode, mix period units',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false],
        ruleParams: {
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
          excludePeriod1: true,
        },
      },
      {
        name: 'Transactions number threshold',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false],
        ruleParams: {
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
          transactionsNumberThreshold: {
            min: 2,
          },
        },
      },
      {
        name: 'Transaction with Different Currencies',
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: {
              transactionCurrency: 'USD',
              transactionAmount: 103,
            },
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 100,
            },
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, true],
        ruleParams: getDefaultParams(),
      },
      {
        name: 'Check multiplier threshold',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
        ruleParams: {
          ...getDefaultParams(),
          multiplierThreshold: {
            currency: 'EUR',
            value: 120,
          },
        },
      },
      {
        name: 'Transaction with Different Currencies and Multiplier threshold',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: {
              transactionAmount: 280,
              transactionCurrency: 'USD',
            },
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false],
        ruleParams: {
          ...getDefaultParams(),
          multiplierThreshold: {
            currency: 'EUR',
            value: 200,
          },
        },
      },
      {
        name: 'Multiple Transactions within Each Period',
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(7, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(6, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(5, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(4, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(3, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(1, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(10, 'minute').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(1, 'minute').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [
          false,
          false,
          false,
          false,
          false,
          true,
          true,
          true,
          true,
          true,
        ],
        ruleParams: {
          period1: {
            granularity: 'day',
            units: 2,
            rollingBasis: true,
          },
          period2: {
            granularity: 'day',
            units: 7,
            rollingBasis: true,
          },
        },
      },
      {
        name: 'Multiple Transactions within Each Period - 2',
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(7, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(6, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(5, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(4, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(3, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(1, 'day').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(10, 'minute').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(1, 'minute').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [
          false,
          false,
          false,
          false,
          false,
          false,
          true,
          true,
          true,
          false,
        ],
        ruleParams: {
          period1: {
            granularity: 'day',
            units: 2,
            rollingBasis: true,
          },
          period2: {
            granularity: 'day',
            units: 7,
            rollingBasis: true,
          },
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-amount-exceeded',
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

  describe('Filters', () => {
    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionsAverageAmountExceededParameters>
      >
    >([
      {
        name: "Minimum transaction number in period2 wouldn't let rule to trigger",
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          }),
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
          }),
        ],
        expectedHits: [false, false],
        ruleParams: {
          transactionsNumberThreshold2: {
            min: 3,
          },
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpUsersHooks(TEST_TENANT_ID, [
        getTestUser({
          userId: '1',
          userDetails: {
            dateOfBirth: '1990-01-01',
            name: {
              firstName: '1',
            },
          },
        }),
      ])

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-amount-exceeded',
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

  describe('Average threshold', () => {
    const now = dayjs('2022-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionsAverageAmountExceededParameters>
      >
    >([
      {
        name: 'First and last transaction should trigger, but average threshold prevent it',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        ruleParams: {
          valueThresholdPeriod1: {
            min: 150,
            max: 250,
          },
        },
        expectedHits: [false, false, false, false],
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-amount-exceeded',
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

    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionsAverageAmountExceededParameters>
      >
    >([
      {
        name: 'Sender -> sending',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.valueOf(),
          }),
          getTestTransaction({
            transactionId: '444',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true, false],
        ruleParams: {
          checkSender: 'sending',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Sender -> all',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '444',
            originUserId: 'Mike',
            destinationUserId: 'Nick',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, false, true],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Receiver -> receiving',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(2, 'day').subtract(5, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(3, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Mike',
            destinationUserId: 'Foo',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(2, 'minute').valueOf(),
          }),
          getTestTransaction({
            transactionId: '444',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'minute').valueOf(),
          }),
          getTestTransaction({
            transactionId: '555',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, false, false, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'receiving',
        },
      },
      {
        name: 'Receiver -> all',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '444',
            originUserId: 'Mike',
            destinationUserId: 'Nick',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, false, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'all',
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-amount-exceeded',
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
    ruleImplementationName: 'transactions-average-amount-exceeded',
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
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
      timestamp: dayjs('2022-01-02T10:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      {
        sendingAmount: 200,
        sendingCount: 2,
        hour: '2022010100',
      },
      {
        sendingAmount: 300,
        sendingCount: 1,
        hour: '2022010210',
      },
    ],
    destination: [
      {
        receivingCount: 2,
        receivingAmount: 200,
        hour: '2022010100',
      },
      {
        receivingCount: 1,
        receivingAmount: 300,
        hour: '2022010210',
      },
    ],
  }
)
