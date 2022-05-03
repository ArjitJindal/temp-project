import dayjs from 'dayjs'
import { UserTransactionPairsRuleParameters } from '../user-transaction-pairs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

dynamoDbSetupHook()

const TEST_TENANT_ID = getTestTenantId()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'user-transaction-pairs-icrypex',
    defaultParameters: {
      userPairsThreshold: 1,
      timeWindowInSeconds: 86400,
      transactionType: 'MATCH_ORDER',
    } as UserTransactionPairsRuleParameters,
    defaultAction: 'FLAG',
  },
])

setUpConsumerUsersHooks(TEST_TENANT_ID, [
  getTestUser({ userId: '1-1' }),
  getTestUser({ userId: '1-2' }),
  getTestUser({ userId: '2-1' }),
  getTestUser({ userId: '2-2' }),
  getTestUser({ userId: '3-1' }),
  getTestUser({ userId: '3-2' }),
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'Too many user pairs: unique order IDs - hit',
    transactions: [
      getTestTransaction({
        transactionId: '100-200',
        type: 'MATCH_ORDER',
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        transactionId: '101-201',
        type: 'MATCH_ORDER',
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
      }),
    ],
    expectedActions: ['ALLOW', 'FLAG'],
  },
  {
    name: 'Too many user pairs: same order ID - not hit',
    transactions: [
      getTestTransaction({
        transactionId: '200-300',
        type: 'MATCH_ORDER',
        originUserId: '2-1',
        destinationUserId: '2-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        transactionId: '200-301',
        type: 'MATCH_ORDER',
        originUserId: '2-1',
        destinationUserId: '2-2',
        timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        transactionId: '201-302',
        type: 'MATCH_ORDER',
        originUserId: '2-1',
        destinationUserId: '2-2',
        timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
  },
  {
    name: 'Too many user pairs: same fill order ID - not hit',
    transactions: [
      getTestTransaction({
        transactionId: '300-400',
        type: 'MATCH_ORDER',
        originUserId: '3-1',
        destinationUserId: '3-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        transactionId: '301-400',
        type: 'MATCH_ORDER',
        originUserId: '3-1',
        destinationUserId: '3-2',
        timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        transactionId: '302-402',
        type: 'MATCH_ORDER',
        originUserId: '3-1',
        destinationUserId: '3-2',
        timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedActions
  )
})
