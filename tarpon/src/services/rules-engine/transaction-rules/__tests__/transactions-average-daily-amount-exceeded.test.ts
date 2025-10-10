import { TransactionsExceededParameters } from '../transactions-exceeded-base'
import { getRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { TransactionsAverageAmountExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-daily-amount-exceeded'
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
  describe('Description formatting', () => {
    describe('R-122 description formatting', () => {
      const TEST_TENANT_ID = getTestTenantId()
      const now = dayjs('2022-01-01T00:00:00.000Z')

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-daily-amount-exceeded',
          defaultParameters: getDefaultParams(),
        },
      ])

      testRuleDescriptionFormatting(
        'first',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-122').descriptionTemplate,
        },
        [
          'Sender made more than 2.00 times average daily amount of transactions in last 1 day than average daily amount of transactions in last 2 days.',
        ]
      )
    })
  })

  const defaultParams = getDefaultParams()

  describe('Core logic', () => {
    const now = dayjs('2022-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<Partial<TransactionsExceededParameters>>
    >([
      {
        name: 'Single transaction always trigger the rule',
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [true],
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
        expectedHits: [true, false],
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
        expectedHits: [true, false, true],
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
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-daily-amount-exceeded',
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
      TransactionRuleTestCase<Partial<TransactionsExceededParameters>>
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
          ruleImplementationName: 'transactions-average-daily-amount-exceeded',
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
      TransactionRuleTestCase<Partial<TransactionsExceededParameters>>
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
            min: 250,
            max: 350,
          },
        },
        expectedHits: [false, false, false, false],
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-daily-amount-exceeded',
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
      TransactionRuleTestCase<Partial<TransactionsExceededParameters>>
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
        expectedHits: [true, false, true, false],
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
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [true, false, true, true],
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
        expectedHits: [true, false, true, false, true],
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
        expectedHits: [true, false, true, true],
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
          ruleImplementationName: 'transactions-average-daily-amount-exceeded',
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
