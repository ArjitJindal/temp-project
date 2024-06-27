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
import { TransactionsAverageNumberExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-number-exceeded'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

const TEST_TRANSACTION_AMOUNT_300: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 300,
}

dynamoDbSetupHook()

function getDefaultParams(): TransactionsAverageNumberExceededParameters {
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
    multiplierThreshold: 100,
    checkSender: 'all',
    checkReceiver: 'all',
  }
}

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('Description formatting', () => {
    describe('R-121 description formatting', () => {
      const TEST_TENANT_ID = getTestTenantId()
      const now = dayjs('2022-01-01T00:00:00.000Z')

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-number-exceeded',
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
          descriptionTemplate: getRuleByRuleId('R-121').descriptionTemplate,
        },
        [
          'Sender made more than 2.00 times avg. number of transactions in last 1 day than avg. number of transactions in last 2 days. Receiver made more than 2.00 times avg. number of transactions in last 1 day than avg. number of transactions in last 2 days.',
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
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
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
          ruleImplementationName: 'transactions-average-number-exceeded',
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
    const now = dayjs('2022-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<Partial<TransactionsExceededParameters>>
    >([
      {
        name: "Minimum transaction number in period 2 wouldn't let rule to trigger",
        transactions: [
          getTestTransaction({
            originUserId: 'Nick',
            destinationUserId: 'Mike',
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false],
        ruleParams: {
          transactionsNumberThreshold2: {
            min: 2,
          },
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-number-exceeded',
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
            destinationUserId: 'Anon#1',
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Anon#2',
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
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
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Anon#2',
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
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
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Anon#2',
            destinationUserId: 'Nick',
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
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
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Anon#2',
            destinationUserId: 'Nick',
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
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
          ruleImplementationName: 'transactions-average-number-exceeded',
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
        name: 'Sender -> sending',
        transactions: [
          getTestTransaction({
            transactionId: '111',
            originUserId: 'Nick',
            destinationUserId: 'Anon#1',
            timestamp: now.subtract(2, 'day').subtract(3, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '222',
            originUserId: 'Nick',
            destinationUserId: 'Anon#2',
            timestamp: now.subtract(1, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originUserId: 'Nick',
            destinationUserId: 'Anon#3',
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '444',
            originUserId: 'Nick',
            destinationUserId: 'Anon#4',
            timestamp: now.subtract(1, 'day').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, false],
        ruleParams: {
          checkSender: 'sending',
          checkReceiver: 'none',
          valueThresholdPeriod1: {
            min: 2,
            max: 2,
          },
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-average-number-exceeded',
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
