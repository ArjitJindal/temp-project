import { TransactionsExceedPastPeriodRuleParameters } from '../transactions-exceed-past-period'
import { getTransactionRuleByRuleId } from '../library'
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

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'transactions-exceed-past-period',
    defaultParameters: {
      multiplierThreshold: 2,
      timeWindow1: {
        units: 5,
        granularity: 'second',
      },
      timeWindow2: {
        units: 10,
        granularity: 'second',
      },
      checkSender: 'all',
      checkReceiver: 'all',
    } as TransactionsExceedPastPeriodRuleParameters,
  },
])

describe('R-131 description formatting', () => {
  testRuleDescriptionFormatting(
    'basic case',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-3',
        timestamp: dayjs('2022-01-01T00:00:05.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-4',
        timestamp: dayjs('2022-01-01T00:00:06.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-5',
        timestamp: dayjs('2022-01-01T00:00:07.000Z').valueOf(),
      }),
    ],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-131').descriptionTemplate,
    },
    [
      null,
      null,
      null,
      'Sender sending transaction(s) in 5 seconds is more than 2 times in 10 seconds',
    ]
  )
})
describe.each<TransactionRuleTestCase>([
  {
    name: 'Exceeded transactions - hit',
    transactions: [
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-3',
        timestamp: dayjs('2022-01-01T00:00:05.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-4',
        timestamp: dayjs('2022-01-01T00:00:06.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-5',
        timestamp: dayjs('2022-01-01T00:00:07.000Z').valueOf(),
      }),
    ],
    expectedHits: [false, false, false, true],
  },
])('', ({ name, transactions, expectedHits }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedHits
  )
})
