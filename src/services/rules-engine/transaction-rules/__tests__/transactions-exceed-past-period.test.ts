import { TransactionsExceedPastPeriodRuleParameters } from '../transactions-exceed-past-period'
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

const TEST_TRANSACTIONS = [
  getTestTransaction({
    originUserId: '2-1',
    destinationUserId: '2-2',
    timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
  }),
  getTestTransaction({
    originUserId: '2-1',
    destinationUserId: '2-3',
    timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
  }),
  getTestTransaction({
    originUserId: '2-1',
    destinationUserId: '2-4',
    timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
  }),
  getTestTransaction({
    originUserId: '2-1',
    destinationUserId: '2-5',
    timestamp: dayjs('2022-01-01T07:00:00.000Z').valueOf(),
  }),
  getTestTransaction({
    originUserId: '2-1',
    destinationUserId: '2-6',
    timestamp: dayjs('2022-01-01T08:00:00.000Z').valueOf(),
  }),
]

dynamoDbSetupHook()

ruleAggregationTest(() => {
  describe('R-131 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-exceed-past-period',
        defaultParameters: {
          multiplierThreshold: 2,
          timeWindow1: {
            units: 5,
            granularity: 'hour',
          },
          timeWindow2: {
            units: 10,
            granularity: 'hour',
          },
          minTransactionsInTimeWindow1: 4,
          checkSender: 'all',
          checkReceiver: 'none',
        } as TransactionsExceedPastPeriodRuleParameters,
      },
    ])

    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      TEST_TRANSACTIONS,
      {
        descriptionTemplate:
          getTransactionRuleByRuleId('R-131').descriptionTemplate,
      },
      [
        null,
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
          multiplierThreshold: 2,
          timeWindow1: {
            units: 5,
            granularity: 'hour',
          },
          timeWindow2: {
            units: 10,
            granularity: 'hour',
          },
          minTransactionsInTimeWindow1: 4,
          checkSender: 'all',
          checkReceiver: 'none',
        } as TransactionsExceedPastPeriodRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Exceeded transactions - hit',
        transactions: TEST_TRANSACTIONS,
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
