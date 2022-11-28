import { TransactionsRoundValuePercentageRuleParameters } from '../transactions-round-value-percentage'
import { getTransactionRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  ruleAggregationTest,
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

dynamoDbSetupHook()

ruleAggregationTest(() => {
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
        descriptionTemplate:
          getTransactionRuleByRuleId('R-124').descriptionTemplate,
      },
      [
        null,
        "Sender is sending funds with more than 50% of transactions as round values ending in 00.00 (hundreds without cents) within time 1 day. Rule should hit after the user has initiaited 1 transactions (doesn't have to be successful). Receiver is receiving funds with more than 50% of transactions as round values ending in 00.00 (hundreds without cents) within time 1 day. Rule should hit after the user has initiaited 1 transactions (doesn't have to be successful).",
        "Receiver is receiving funds with more than 50% of transactions as round values ending in 00.00 (hundreds without cents) within time 1 day. Rule should hit after the user has initiaited 1 transactions (doesn't have to be successful).",
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
})
