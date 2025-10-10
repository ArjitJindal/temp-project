import { TransactionsRoundValuePercentageRuleParameters } from '../transactions-round-value-percentage'
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
  transactionCurrency: 'USD',
  transactionAmount: 100,
}
const TEST_TRANSACTION_AMOUNT_101: TransactionAmountDetails = {
  transactionCurrency: 'USD',
  transactionAmount: 101,
}
const DEFAULT_RULE_PARAMETERS: TransactionsRoundValuePercentageRuleParameters =
  {
    timeWindow: {
      units: 1,
      granularity: 'day',
    },
    initialTransactions: 1,
    patternPercentageLimit: 50,
  }

dynamoDbSetupHook()
ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('R-124 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-round-value-percentage',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
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
        descriptionTemplate: getRuleByRuleId('R-124').descriptionTemplate,
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
          patternPercentageLimit: 35,
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
            originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
          }),
          // 1 / 3 = 33.33% (< 35%)
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
          // 2 / 5 = 40% (> 35%)
          getTestTransaction({
            originUserId: '4',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2000-01-01T01:00:04.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false, false, true],
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

  describe('Sender and receiver checks', () => {
    const TEST_TENANT_ID = getTestTenantId()

    const baseRuleConfig = {
      type: 'TRANSACTION' as const,
      ruleImplementationName: 'transactions-round-value-percentage',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        initialTransactions: 2,
        patternPercentageLimit: 35,
      },
      defaultAction: 'FLAG',
    }

    describe('With checkSender: sending and checkReceiver: receiving', () => {
      setUpRulesHooks(TEST_TENANT_ID, [
        {
          ...baseRuleConfig,
          defaultParameters: {
            ...baseRuleConfig.defaultParameters,
            checkSender: 'sending',
            checkReceiver: 'receiving',
          },
        },
      ])

      describe.each<
        TransactionRuleTestCase<TransactionsRoundValuePercentageRuleParameters>
      >([
        {
          name: 'Check sender sending only',
          transactions: [
            getTestTransaction({
              originUserId: '1',
              destinationUserId: '2',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
            }),
            getTestTransaction({
              originUserId: '1',
              destinationUserId: '2',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
            }),
            // 2/2 = 100% round values for sender
            getTestTransaction({
              originUserId: '1',
              destinationUserId: '2',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
            }),
          ],
          expectedHits: [false, false, true],
        },
        {
          name: 'Check receiver receiving only',
          transactions: [
            getTestTransaction({
              originUserId: '2',
              destinationUserId: '6',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
            }),
            getTestTransaction({
              originUserId: '2',
              destinationUserId: '6',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
            }),
            getTestTransaction({
              originUserId: '2',
              destinationUserId: '6',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
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

    describe('With checkSender: none', () => {
      setUpRulesHooks(TEST_TENANT_ID, [
        {
          ...baseRuleConfig,
          defaultParameters: {
            ...baseRuleConfig.defaultParameters,
            checkSender: 'none',
            checkReceiver: 'receiving',
          },
        },
      ])

      describe.each<
        TransactionRuleTestCase<TransactionsRoundValuePercentageRuleParameters>
      >([
        {
          name: 'Check sender none',
          transactions: [
            getTestTransaction({
              originUserId: '1',
              destinationUserId: '2',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
            }),
            getTestTransaction({
              originUserId: '1',
              destinationUserId: '2',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
            }),
            // Should not hit even with 100% round values for sender
            getTestTransaction({
              originUserId: '1',
              destinationUserId: '2',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
            }),
          ],
          expectedHits: [false, false, false],
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

    describe('With checkReceiver: none', () => {
      setUpRulesHooks(TEST_TENANT_ID, [
        {
          ...baseRuleConfig,
          defaultParameters: {
            ...baseRuleConfig.defaultParameters,
            checkSender: 'sending',
            checkReceiver: 'none',
          },
        },
      ])

      describe.each<
        TransactionRuleTestCase<TransactionsRoundValuePercentageRuleParameters>
      >([
        {
          name: 'Check receiver none',
          transactions: [
            getTestTransaction({
              originUserId: '2',
              destinationUserId: '1',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
            }),
            getTestTransaction({
              originUserId: '2',
              destinationUserId: '1',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
            }),
            // Should not hit even with 100% round values for receiver
            getTestTransaction({
              originUserId: '2',
              destinationUserId: '1',
              originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
              destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
              timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
            }),
          ],
          expectedHits: [false, false, false],
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
})

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'transactions-round-value-percentage',
    defaultParameters: {
      timeWindow: {
        units: 1,
        granularity: 'day',
        rollingBasis: true,
      },
      initialTransactions: 1,
      patternPercentageLimit: 50,
    },
  },
  [
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2023-01-01T01:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
      timestamp: dayjs('2023-01-01T01:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '2',
      destinationUserId: '1',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2023-01-01T03:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      { all: 2, match: 1, hour: '2023010101' },
      { all: 1, match: 1, hour: '2023010103' },
    ],
    destination: [
      { all: 2, match: 1, hour: '2023010101' },
      { all: 1, match: 1, hour: '2023010103' },
    ],
  }
)
