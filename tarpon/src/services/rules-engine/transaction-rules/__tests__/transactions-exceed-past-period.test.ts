import { TransactionsExceedPastPeriodRuleParameters } from '../transactions-exceed-past-period'
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

const DEFAULT_RULE_PARAMETERS: TransactionsExceedPastPeriodRuleParameters = {
  multiplierThreshold: 2,
  timeWindow1: {
    units: 5,
    granularity: 'hour',
  },
  timeWindow2: {
    units: 10,
    granularity: 'hour',
  },
  minTransactionsInTimeWindow2: 1,
  checkSender: 'all',
  checkReceiver: 'none',
}

dynamoDbSetupHook()
ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('R-131 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-exceed-past-period',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
      },
    ])

    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-4',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-4',
          timestamp: dayjs('2022-01-01T07:00:00.000Z').valueOf(),
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-131').descriptionTemplate,
      },
      [
        null,
        null,
        null,
        'Sender sending transaction(s) in 5 hours is more than 2 times in 10 hours.',
      ]
    )
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-exceed-past-period',
        defaultParameters: {
          multiplierThreshold: 1,
          timeWindow1: {
            units: 5,
            granularity: 'hour',
          },
          timeWindow2: {
            units: 10,
            granularity: 'hour',
          },
          minTransactionsInTimeWindow1: 2,
          minTransactionsInTimeWindow2: 1,
          initialTransactions: 5,
          checkSender: 'all',
          checkReceiver: 'none',
        } as TransactionsExceedPastPeriodRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Exceeded transactions - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-5',
            timestamp: dayjs('2022-01-01T07:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-6',
            timestamp: dayjs('2022-01-01T08:00:00.000Z').valueOf(),
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
})

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'transactions-exceed-past-period',
    defaultParameters: {
      ...DEFAULT_RULE_PARAMETERS,
      checkSender: 'all',
      checkReceiver: 'all',
    },
  },
  [
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '3',
      timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      timestamp: dayjs('2022-01-01T07:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      { count: 2, hour: '2022010100' },
      { count: 1, hour: '2022010106' },
      { count: 1, hour: '2022010107' },
    ],
    destination: [
      { count: 2, hour: '2022010100' },
      { count: 1, hour: '2022010107' },
    ],
  }
)
