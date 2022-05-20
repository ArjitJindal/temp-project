import dayjs from 'dayjs'
import { TransactionsVelocityRuleParameters } from '../transactions-velocity'
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

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsPerSecond: 0.4,
        timeWindowInSeconds: 5,
        checkSender: 'all',
        checkReceiver: 'all',
      } as TransactionsVelocityRuleParameters,
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too frequent sending transactions - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
    },
    {
      name: 'Too frequent receiving transactions - hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-2',
          destinationUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-3',
          destinationUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-4',
          destinationUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
    },
    {
      name: 'Too frequent sending and receiving transactions - hit',
      transactions: [
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-3',
          destinationUserId: '3-1',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
    },
    {
      name: 'Frequent transactions by different users - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '4-1',
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '4-3',
          destinationUserId: '4-4',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '4-5',
          destinationUserId: '4-6',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Frequent transactions without user IDs - not hit',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Normal transactions - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-3',
          timestamp: dayjs('2022-01-01T00:00:10.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-4',
          timestamp: dayjs('2022-01-01T00:00:20.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Too frequent transactions - hit twice',
      transactions: [
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:10:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:10:02.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'ALLOW', 'FLAG'],
    },
    {
      name: 'Out-of-order transactions - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Duplicated transactions - not hit',
      transactions: [
        getTestTransaction({
          transactionId: '8-1',
          originUserId: '8-1',
          destinationUserId: '8-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          transactionId: '8-1',
          originUserId: '8-1',
          destinationUserId: '8-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          transactionId: '8-1',
          originUserId: '8-1',
          destinationUserId: '8-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
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
})

describe('Optional parameters', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsPerSecond: 1,
        timeWindowInSeconds: 1,
        checkTimeWindow: {
          from: '09:00:00+00:00',
          to: '18:00:00+00:00',
        },
        userIdsToCheck: ['1-1', '3-1'],
        checkSender: 'all',
        checkReceiver: 'all',
      } as TransactionsVelocityRuleParameters,
    },
  ])

  setUpConsumerUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1-1' }),
    getTestUser({ userId: '2-1' }),
    getTestUser({ userId: '3-1' }),
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'User in the list and transaction time within the window - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T10:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T10:00:00.100Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'FLAG'],
    },
    {
      name: 'User not in the list - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T10:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-3',
          timestamp: dayjs('2022-01-01T10:00:00.100Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW'],
    },
    {
      name: 'Transaction time not within the window - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-3',
          timestamp: dayjs('2022-01-01T00:00:00.100Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW'],
    },
  ])('', ({ name, transactions, expectedActions }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedActions
    )
  })
})

describe('checksender/checkreceiver', () => {
  const TEST_HIT_TRANSACTIONS = [
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-4',
      destinationUserId: '1-3',
      timestamp: dayjs('2022-01-01T00:00:03.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-5',
      destinationUserId: '1-3',
      timestamp: dayjs('2022-01-01T00:00:04.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-6',
      destinationUserId: '1-3',
      timestamp: dayjs('2022-01-01T00:00:05.000Z').valueOf(),
    }),
  ]

  describe.each<
    TransactionRuleTestCase<Partial<TransactionsVelocityRuleParameters>>
  >([
    {
      name: 'Sender: all, Receiver: all',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'ALLOW', 'FLAG'],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'all',
      },
    },
    {
      name: 'Sender: sending, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'ALLOW', 'ALLOW'],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
      },
    },
    {
      name: 'Sender: all, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'ALLOW', 'ALLOW'],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'none',
      },
    },
    {
      name: 'Sender: none, Receiver: receiving',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW', 'ALLOW', 'FLAG'],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'receiving',
      },
    },
    {
      name: 'Sender: none, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW', 'ALLOW', 'ALLOW', 'ALLOW'],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'none',
      },
    },
  ])('', ({ name, transactions, expectedActions, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: {
          transactionsPerSecond: 0.4,
          timeWindowInSeconds: 5,
          ...ruleParams,
        } as TransactionsVelocityRuleParameters,
      },
    ])

    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedActions
    )
  })
})
