import { TransactionsAverageExceededParameters } from '../transactions-average-exceeded'
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

const TEST_TRANSACTION_AMOUNT_300 = {
  transactionCurrency: 'EUR',
  transactionAmount: 300,
}

dynamoDbSetupHook()

function getDefaultParams(
  method: 'amount' | 'number'
): TransactionsAverageExceededParameters {
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
    multiplierThresholds: {
      EUR: 1,
    },
    checkSender: 'all',
    checkReceiver: 'all',
    avgMethod: method,
  }
}

describe('Description formatting', () => {
  describe('R-121 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const now = dayjs('2022-01-01T00:00:00.000Z')

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-average-exceeded',
        defaultParameters: getDefaultParams('number'),
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
        descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more than {{ to-fixed multiplier }} times avg. number of transactions in last {{ format-time-window period1 }} than avg. number of transactions in last {{ format-time-window period2 }}`,
      },
      [
        'Sender made more than 2.00 times avg. number of transactions in last 1 day than avg. number of transactions in last 2 days',
      ]
    )
  })

  describe('R-122 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const now = dayjs('2022-01-01T00:00:00.000Z')

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-average-exceeded',
        defaultParameters: getDefaultParams('amount'),
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
        descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more than {{ to-fixed multiplier }} times avg. amount of transactions in last {{ format-time-window period1 }} than avg. number of transactions in last {{ format-time-window period2 }}`,
      },
      [
        'Sender made more than 2.00 times avg. amount of transactions in last 1 day than avg. number of transactions in last 2 days',
      ]
    )
  })
})

describe('Method: amount', () => {
  const defaultParams = getDefaultParams('amount')

  describe('Core login', () => {
    const now = dayjs('2022-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<Partial<TransactionsAverageExceededParameters>>
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
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-exceeded',
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
      TransactionRuleTestCase<Partial<TransactionsAverageExceededParameters>>
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
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
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
        expectedHits: [true, false, false, true],
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
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
          ruleImplementationName: 'transactions-average-exceeded',
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

describe('Method: number', () => {
  const defaultParams = getDefaultParams('number')

  describe('Core logic', () => {
    const now = dayjs('2022-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<Partial<TransactionsAverageExceededParameters>>
    >([
      {
        name: 'Single transaction always trigger the rule',
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
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
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [true, false],
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-exceeded',
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
      TransactionRuleTestCase<Partial<TransactionsAverageExceededParameters>>
    >([
      {
        name: 'Sender -> sending',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Anon#1',
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Anon#2',
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Anon#3',
            timestamp: now.subtract(1, 'day').valueOf(),
          }),
        ],
        expectedHits: [true, false, true],
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
            destinationUserId: 'Anon#1',
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Anon#2',
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Anon#3',
            timestamp: now.subtract(1, 'day').valueOf(),
          }),
        ],
        expectedHits: [true, false, true],
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
            originUserId: 'Anon#1',
            destinationUserId: 'Nick',
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Anon#2',
            destinationUserId: 'Nick',
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Anon#3',
            destinationUserId: 'Nick',
            timestamp: now.subtract(1, 'day').valueOf(),
          }),
        ],
        expectedHits: [true, false, true],
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
            originUserId: 'Anon#1',
            destinationUserId: 'Nick',
            timestamp: now.subtract(2, 'day').subtract(2, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Anon#2',
            destinationUserId: 'Nick',
            timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Anon#3',
            destinationUserId: 'Nick',
            timestamp: now.subtract(1, 'day').valueOf(),
          }),
        ],
        expectedHits: [true, false, true],
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
          ruleImplementationName: 'transactions-average-exceeded',
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
