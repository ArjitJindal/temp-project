import { TransactionsAverageExceededParameters } from '../transactions-average-exceeded-base'
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
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'
import { TransactionsAverageAmountExceededParameters } from '@/services/rules-engine/transaction-rules/transactions-average-amount-exceeded'

const TEST_TRANSACTION_AMOUNT_100 = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_AMOUNT_300 = {
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
    multiplierThresholds: {
      EUR: 1,
    },
    checkSender: 'all',
    checkReceiver: 'all',
  }
}

describe('Description formatting', () => {
  describe('R-122 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const now = dayjs('2022-01-01T00:00:00.000Z')

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-average-amount-exceeded',
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
        descriptionTemplate: `{{ if-sender 'Sender' 'Receiver' }} made more than {{ to-fixed multiplier }} times avg. amount of transactions in last {{ format-time-window period1 }} than avg. number of transactions in last {{ format-time-window period2 }}`,
      },
      [
        'Sender made more than 2.00 times avg. amount of transactions in last 1 day than avg. number of transactions in last 2 days',
      ]
    )
  })
})

const defaultParams = getDefaultParams()

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
    {
      name: 'Check exclude mode',
      transactions: [
        getTestTransaction({
          transactionId: '111',
          originUserId: 'Nick',
          destinationUserId: 'Mike',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
      expectedHits: [true, false],
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
          timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
      expectedHits: [true, false],
      ruleParams: {
        period1: {
          granularity: 'day',
          units: 1,
          rollingBasis: true,
        },
        period2: {
          granularity: 'hour',
          units: 48,
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
          timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
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
      name: 'Average threshold',
      transactions: [
        getTestTransaction({
          transactionId: '111',
          originUserId: 'Nick',
          destinationUserId: 'Mike',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.subtract(1, 'day').subtract(1, 'second').valueOf(),
        }),
        getTestTransaction({
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
        averageThreshold: {
          max: 99,
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
  const now = dayjs('2022-01-01T00:00:00.000Z')

  describe.each<
    TransactionRuleTestCase<Partial<TransactionsAverageExceededParameters>>
  >([
    {
      name: 'User age filter',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.valueOf(),
        }),
      ],
      ruleParams: {
        ageRange: {
          minAge: 18,
          maxAge: 20,
        },
      },
      expectedHits: [false],
    },
    {
      name: 'User type filter',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: undefined,
          timestamp: now.valueOf(),
        }),
      ],
      ruleParams: {
        userType: 'BUSINESS',
      },
      expectedHits: [false],
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpConsumerUsersHooks(TEST_TENANT_ID, [
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
