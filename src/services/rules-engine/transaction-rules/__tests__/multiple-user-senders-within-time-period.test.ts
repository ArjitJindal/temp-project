import dayjs from 'dayjs'
import { MultipleSendersWithinTimePeriodRuleParameters } from '../multiple-senders-within-time-period-base'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'multiple-user-senders-within-time-period',
    defaultParameters: {
      sendersCount: 2,
      timePeriodDays: 30,
    } as MultipleSendersWithinTimePeriodRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'Same sender user transacting with different originUserID (within time period) - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-3',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-4',
        timestamp: dayjs('2022-01-25T00:00:00.000Z').valueOf(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Different sender user transacting with same originUserID (within time period) - hit',
    transactions: [
      getTestTransaction({
        originUserId: '2-2',
        destinationUserId: '2-1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-3',
        destinationUserId: '2-1',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '2-4',
        destinationUserId: '2-1',
        timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
  },
  {
    name: 'Different sender user transacting with same originUserID (not within time period) - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '3-1',
        destinationUserId: '3-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '3-3',
        destinationUserId: '3-2',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '3-4',
        destinationUserId: '3-2',
        timestamp: dayjs('2022-02-29T00:00:00.000Z').valueOf(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Same sender user transacting with same originUserID (within time period) - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-2',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-2',
        timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedActions
  )
})
