import dayjs from 'dayjs'
import { ConsecutiveTransactionSameTypeRuleParameters } from '../consecutive-transactions-same-type'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createRuleTestCase,
  RuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    ruleImplementationFilename: 'consecutive-transactions-same-type',
    defaultParameters: {
      targetTransactionsThreshold: 2,
      targetTransactionType: 'CRYPTO_DEPOSIT',
      otherTransactionTypes: ['FIAT_DEPOSIT', 'OTHER_DEPOSIT'],
      timeWindowInDays: 30,
    } as ConsecutiveTransactionSameTypeRuleParameters,
    defaultAction: 'FLAG',
  },
])

setUpConsumerUsersHooks(TEST_TENANT_ID, [
  getTestUser({ userId: '1-1' }),
  getTestUser({ userId: '2-1' }),
  getTestUser({ userId: '3-1' }),
  getTestUser({ userId: '4-1' }),
])

describe.each<RuleTestCase>([
  {
    name: 'Consecutive transactions of the target type (w/o other types) - hit',
    transactions: [
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-05T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-10T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-20T06:00:00.000Z').unix(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'FLAG'],
  },
  {
    name: 'Consecutive transactions of the target type (with other types) - hit',
    transactions: [
      getTestTransaction({
        type: 'FIAT_DEPOSIT',
        senderUserId: '2-1',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '2-1',
        timestamp: dayjs('2022-01-05T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '2-1',
        timestamp: dayjs('2022-01-10T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '2-1',
        timestamp: dayjs('2022-01-20T06:00:00.000Z').unix(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW', 'FLAG'],
  },
  {
    name: 'Non-consecutive transactions of the target type - not hit',
    transactions: [
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'FIAT_DEPOSIT',
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-05T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'OTHER_DEPOSIT',
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-06T00:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-07T00:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'CRYPTO_DEPOSIT',
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-07T00:00:00.000Z').unix(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW', 'ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Consecutive transactions of the non-target type - not hit',
    transactions: [
      getTestTransaction({
        type: 'FIAT_DEPOSIT',
        senderUserId: '4-1',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'FIAT_DEPOSIT',
        senderUserId: '4-1',
        timestamp: dayjs('2022-01-05T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'FIAT_DEPOSIT',
        senderUserId: '4-1',
        timestamp: dayjs('2022-01-10T06:00:00.000Z').unix(),
      }),
      getTestTransaction({
        type: 'FIAT_DEPOSIT',
        senderUserId: '4-1',
        timestamp: dayjs('2022-01-20T06:00:00.000Z').unix(),
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW', 'ALLOW'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createRuleTestCase(name, TEST_TENANT_ID, transactions, expectedActions)
})
