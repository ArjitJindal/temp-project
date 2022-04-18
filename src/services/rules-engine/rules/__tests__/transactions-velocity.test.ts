import dayjs from 'dayjs'
import { TransactionsVelocityRuleParameters } from '../transactions-velocity'
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

dynamoDbSetupHook()

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      ruleImplementationFilename: 'transactions-velocity',
      defaultParameters: {
        transactionsPerSecond: 0.4,
        timeWindowInSeconds: 5,
      } as TransactionsVelocityRuleParameters,
    },
  ])

  describe.each<RuleTestCase>([
    {
      name: 'Too frequent sending transactions - hit',
      transactions: [
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
    },
    {
      name: 'Too frequent receiving transactions - hit',
      transactions: [
        getTestTransaction({
          senderUserId: '2-2',
          receiverUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '2-3',
          receiverUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '2-4',
          receiverUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
    },
    {
      name: 'Too frequent sending and receiving transactions - hit',
      transactions: [
        getTestTransaction({
          senderUserId: '3-1',
          receiverUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '3-3',
          receiverUserId: '3-1',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '3-1',
          receiverUserId: '3-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
    },
    {
      name: 'Frequent transactions by different users - not hit',
      transactions: [
        getTestTransaction({
          senderUserId: '4-1',
          receiverUserId: '4-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '4-3',
          receiverUserId: '4-4',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '4-5',
          receiverUserId: '4-6',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Frequent transactions without user IDs - not hit',
      transactions: [
        getTestTransaction({
          senderUserId: undefined,
          receiverUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: undefined,
          receiverUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:01.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: undefined,
          receiverUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:02.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Normal transactions - not hit',
      transactions: [
        getTestTransaction({
          senderUserId: '5-1',
          receiverUserId: '5-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '5-1',
          receiverUserId: '5-3',
          timestamp: dayjs('2022-01-01T00:00:10.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '5-1',
          receiverUserId: '5-4',
          timestamp: dayjs('2022-01-01T00:00:20.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Too frequent transactions - hit twice',
      transactions: [
        getTestTransaction({
          senderUserId: '6-1',
          receiverUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '6-1',
          receiverUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '6-1',
          receiverUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '6-1',
          receiverUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:10:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '6-1',
          receiverUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:10:01.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '6-1',
          receiverUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:10:02.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'ALLOW', 'FLAG'],
    },
  ])('', ({ name, transactions, expectedActions }) => {
    createRuleTestCase(name, TEST_TENANT_ID, transactions, expectedActions)
  })
})

describe('Optional parameters', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      ruleImplementationFilename: 'transactions-velocity',
      defaultParameters: {
        transactionsPerSecond: 1,
        timeWindowInSeconds: 1,
        checkTimeWindow: {
          from: '09:00:00+00:00',
          to: '18:00:00+00:00',
        },
        userIdsToCheck: ['1-1', '3-1'],
      } as TransactionsVelocityRuleParameters,
    },
  ])

  setUpConsumerUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1-1' }),
    getTestUser({ userId: '2-1' }),
    getTestUser({ userId: '3-1' }),
  ])

  describe.each<RuleTestCase>([
    {
      name: 'User in the list and transaction time within the window - hit',
      transactions: [
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T10:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-3',
          timestamp: dayjs('2022-01-01T10:00:00.100Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'FLAG'],
    },
    {
      name: 'User not in the list - not hit',
      transactions: [
        getTestTransaction({
          senderUserId: '2-1',
          receiverUserId: '2-2',
          timestamp: dayjs('2022-01-01T10:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '2-1',
          receiverUserId: '2-3',
          timestamp: dayjs('2022-01-01T10:00:00.100Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW'],
    },
    {
      name: 'Transaction time not within the window - not hit',
      transactions: [
        getTestTransaction({
          senderUserId: '3-1',
          receiverUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '3-1',
          receiverUserId: '3-3',
          timestamp: dayjs('2022-01-01T00:00:00.100Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW'],
    },
  ])('', ({ name, transactions, expectedActions }) => {
    createRuleTestCase(name, TEST_TENANT_ID, transactions, expectedActions)
  })
})
