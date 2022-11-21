import { getTransactionRuleByRuleId } from '../library'
import { TransactionsRoundValueVelocityRuleParameters } from '../transactions-round-value-velocity'
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
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_AMOUNT_101: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 101,
}

const TEST_TRANSACTION_AMOUNT_200: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 200,
}

const TEST_TRANSACTION_AMOUNT_300: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 300,
}

dynamoDbSetupHook()

describe('R-130 description formatting', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-velocity',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        transactionsLimit: 1,
      } as TransactionsRoundValueVelocityRuleParameters,
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
        destinationUserId: '3',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '4',
        destinationUserId: '2',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
      }),
    ],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-130').descriptionTemplate,
    },
    [
      null,
      'Sender is sending 1 or more transactions as round values ending in 00.00 (hundreds without cents) within time 1 day',
      'Receiver is receiving 1 or more transactions as round values ending in 00.00 (hundreds without cents) within time 1 day',
    ]
  )
})

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-velocity',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        transactionsLimit: 1,
      } as TransactionsRoundValueVelocityRuleParameters,
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
          destinationUserId: '3',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_200,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_200,
          timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '4',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
          timestamp: dayjs('2000-01-01T01:00:03.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '5',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
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
describe('Optional parameter - Same Amount', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-round-value-velocity',
      defaultParameters: {
        sameAmount: true,
        transactionsLimit: 1,
        timeWindow: {
          units: 5,
          granularity: 'second',
        },
        checkSender: 'all',
        checkReceiver: 'all',
      } as TransactionsRoundValueVelocityRuleParameters,
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Amount and currency are same - hit',
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
          originAmountDetails: TEST_TRANSACTION_AMOUNT_200,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_200,
          timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, true],
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
