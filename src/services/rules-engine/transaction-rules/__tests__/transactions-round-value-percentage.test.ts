import { TRANSACTION_RULES_LIBRARY } from '../library'
import { TransactionsRoundValuePercentageRuleParameters } from '../transactions-round-value-percentage'
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

const TEST_TRANSACTION_AMOUNT_100 = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_AMOUNT_101 = {
  transactionCurrency: 'EUR',
  transactionAmount: 101,
}

const DESCRIPTION_TEMPLATE = TRANSACTION_RULES_LIBRARY.find(
  (rule) => rule().id === 'R-124'
)?.().descriptionTemplate as string

dynamoDbSetupHook()

describe('R-124 description formatting', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-percentage',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        initialTransactions: 1,
        patternPercentageLimit: 50,
      } as TransactionsRoundValuePercentageRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        destinationUserId: '2',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '3',
        destinationUserId: '2',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
      }),
    ],
    {
      descriptionTemplate: DESCRIPTION_TEMPLATE,
    },
    [
      null,
      "Sender is sending funds with more than 50% of transactions as round values ending in 00.00 (hundreds without cents) within time 1 day(s). Rule should hit after the user has initiaited 1 transactions (doesn't have to be successful)",
      "Receiver is receiving funds with more than 50% of transactions as round values ending in 00.00 (hundreds without cents) within time 1 day(s). Rule should hit after the user has initiaited 1 transactions (doesn't have to be successful)",
    ]
  )
})

describe('Core logic without filters', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-percentage',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        initialTransactions: 2,
        patternPercentageLimit: 50,
      } as TransactionsRoundValuePercentageRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too many round values',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
          timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
          timestamp: dayjs('2000-01-01T01:00:03.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '4',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:04.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, true, false, true],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Core logic with optional filters - paymentMethod', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-percentage',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        initialTransactions: 0,
        patternPercentageLimit: 30,
        paymentMethod: 'ACH',
      } as TransactionsRoundValuePercentageRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too many round values',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          originPaymentDetails: {
            method: 'CARD',
          },
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          originPaymentDetails: {
            method: 'ACH',
            routingNumber: 'routingNumber',
            accountNumber: 'accountNumber',
          },
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Core logic with optional filters - transactionState', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-percentage',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        initialTransactions: 0,
        patternPercentageLimit: 30,
        transactionState: 'DECLINED',
      } as TransactionsRoundValuePercentageRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too many round values',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          transactionState: 'DECLINED',
        }),
      ],
      expectedHits: [false, true],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Core logic with optional filters - transactionTypes', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-percentage',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        initialTransactions: 0,
        patternPercentageLimit: 30,
        transactionTypes: ['WITHDRAWAL'],
      } as TransactionsRoundValuePercentageRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too many round values',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          type: 'DEPOSIT',
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          type: 'WITHDRAWAL',
        }),
      ],
      expectedHits: [false, true],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Core logic with optional filters - userType', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-percentage',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        initialTransactions: 0,
        patternPercentageLimit: 30,
        userType: 'CONSUMER',
      } as TransactionsRoundValuePercentageRuleParameters,
      defaultAction: 'FLAG',
    },
  ])
  setUpConsumerUsersHooks(TEST_TENANT_ID, [getTestUser({ userId: '3' })])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too many round values',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})
