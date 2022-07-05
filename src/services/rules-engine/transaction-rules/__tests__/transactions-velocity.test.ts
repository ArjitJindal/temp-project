import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
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
        transactionsLimit: 2,
        timeWindow: {
          units: 5,
          granularity: 'second',
        },
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
      expectedHits: [false, false, true],
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
      expectedHits: [false, false, true],
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
      expectedHits: [false, false, true],
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
      expectedHits: [false, false, false],
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
      expectedHits: [false, false, false],
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
      expectedHits: [false, false, false],
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
      expectedHits: [false, false, true, false, false, true],
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
      expectedHits: [false, false, false],
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

describe('Optional parameters', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsLimit: 1,
        timeWindow: {
          units: 1,
          granularity: 'second',
        },
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
      expectedHits: [false, true],
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
      expectedHits: [false, false],
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
      expectedHits: [false, false],
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
      expectedHits: [false, false, true, false, false, true],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'all',
      },
    },
    {
      name: 'Sender: sending, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedHits: [false, false, true, false, false, false],
      ruleParams: {
        checkSender: 'sending',
        checkReceiver: 'none',
      },
    },
    {
      name: 'Sender: all, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedHits: [false, false, true, false, false, false],
      ruleParams: {
        checkSender: 'all',
        checkReceiver: 'none',
      },
    },
    {
      name: 'Sender: none, Receiver: receiving',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedHits: [false, false, true, false, false, true],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'receiving',
      },
    },
    {
      name: 'Sender: none, Receiver: none',
      transactions: TEST_HIT_TRANSACTIONS,
      expectedHits: [false, false, false, false, false, false],
      ruleParams: {
        checkSender: 'none',
        checkReceiver: 'none',
      },
    },
  ])('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: {
          transactionsLimit: 2,
          timeWindow: {
            units: 5,
            granularity: 'second',
          },
          ...ruleParams,
        } as TransactionsVelocityRuleParameters,
      },
    ])
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

describe('Transaction State', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsLimit: 2,
        timeWindow: {
          units: 1,
          granularity: 'second',
        },
        checkSender: 'all',
        checkReceiver: 'all',
        transactionState: 'SUCCESSFUL',
      } as TransactionsVelocityRuleParameters,
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Skip transactions with non-target state',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T10:00:00.000Z').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T10:00:00.100Z').valueOf(),
          transactionState: 'DECLINED',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-4',
          timestamp: dayjs('2022-01-01T10:00:00.200Z').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-5',
          timestamp: dayjs('2022-01-01T10:00:00.300Z').valueOf(),
          transactionState: 'SUCCESSFUL',
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
})

describe('Optional parameter - Transaction type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsLimit: 2,
        timeWindow: {
          units: 5,
          granularity: 'second',
        },
        checkSender: 'all',
        checkReceiver: 'all',
        transactionType: 'Withdrawal',
      } as TransactionsVelocityRuleParameters,
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too frequent sending transactions with same transaction type - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          type: 'Withdrawal',
        }),
      ],
      expectedHits: [false, false, true],
    },
    {
      name: 'Too frequent sending transactions with different transaction type - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          type: 'Deposit',
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          type: 'Wthdrawal',
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Frequent transactions by different users - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '3-3',
          destinationUserId: '3-4',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '3-5',
          destinationUserId: '3-6',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          type: 'Withdrawal',
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Frequent transactions without user IDs - not hit',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          type: 'Withdrawal',
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Normal transactions - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-3',
          timestamp: dayjs('2022-01-01T00:00:10.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-4',
          timestamp: dayjs('2022-01-01T00:00:20.000Z').valueOf(),
          type: 'Withdrawal',
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Too frequent transactions with same transaction type - hit twice',
      transactions: [
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:10:01.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:10:02.000Z').valueOf(),
          type: 'Withdrawal',
        }),
      ],
      expectedHits: [false, false, true, false, false, true],
    },
    {
      name: 'Too frequent transactions with different transaction type - not hit ',
      transactions: [
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          type: 'Deposit',
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-2',
          timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-3',
          timestamp: dayjs('2022-01-01T00:10:01.000Z').valueOf(),
          type: 'Withdrawal',
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-4',
          timestamp: dayjs('2022-01-01T00:10:02.000Z').valueOf(),
          type: 'Deposit',
        }),
      ],
      expectedHits: [false, false, false, false, false, false],
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

describe('Rolling basis parameter', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsLimit: 1,
        timeWindow: {
          units: 1,
          granularity: 'day',
          rollingBasis: false,
        },
        checkSender: 'all',
        checkReceiver: 'all',
      } as TransactionsVelocityRuleParameters,
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Transaction out of limit - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true],
    },
    {
      name: 'Transaction in limit - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T11:59:59.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-3',
          timestamp: dayjs('2022-01-02T00:00:01.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false],
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

describe('Optional parameter - Payment Method', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsLimit: 2,
        timeWindow: {
          units: 5,
          granularity: 'second',
        },
        checkSender: 'all',
        checkReceiver: 'all',
        paymentMethod: 'CARD',
      } as TransactionsVelocityRuleParameters,
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too frequent sending transactions with same payment method - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
      ],
      expectedHits: [false, false, true],
    },
    {
      name: 'Too frequent sending transactions with different payment method - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'savings',
          },
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Frequent transactions by different users - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '3-3',
          destinationUserId: '3-4',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '3-5',
          destinationUserId: '3-6',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Frequent transactions without user IDs - not hit',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: 'fingerprint',
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: 'fingerprint',
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: undefined,
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: 'fingerprint',
          },
        }),
      ],
      expectedHits: [false, false, true],
    },
    {
      name: 'Normal transactions - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-3',
          timestamp: dayjs('2022-01-01T00:00:10.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-4',
          timestamp: dayjs('2022-01-01T00:00:20.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Too frequent transactions with same payment method - hit twice',
      transactions: [
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-2',
          timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-3',
          timestamp: dayjs('2022-01-01T00:10:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '6-1',
          destinationUserId: '6-4',
          timestamp: dayjs('2022-01-01T00:10:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
      ],
      expectedHits: [false, false, true, false, false, true],
    },
    {
      name: 'Too frequent transactions with different payment method - not hit ',
      transactions: [
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'savings',
          },
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-2',
          timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-3',
          timestamp: dayjs('2022-01-01T00:10:01.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: uuidv4(),
          },
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-4',
          timestamp: dayjs('2022-01-01T00:10:02.000Z').valueOf(),
          originPaymentDetails: {
            method: 'WALLET',
            walletType: 'savings',
          },
        }),
      ],
      expectedHits: [false, false, false, false, false, false],
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

describe('Optional parameter - User type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transactions-velocity',
      defaultParameters: {
        transactionsLimit: 2,
        timeWindow: {
          units: 5,
          granularity: 'second',
        },
        checkSender: 'all',
        checkReceiver: 'all',
        userType: 'CONSUMER',
      } as TransactionsVelocityRuleParameters,
    },
  ])
  setUpConsumerUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1-1' }),
    getTestUser({ userId: '3-1' }),
    getTestUser({ userId: '5-1' }),
    getTestUser({ userId: '6-1' }),
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too frequent sending transactions with same userType - hit',
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
      expectedHits: [false, false, true],
    },
    {
      name: 'Too frequent sending transactions with different userType - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Frequent transactions by different users - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-3',
          destinationUserId: '3-4',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-5',
          destinationUserId: '3-6',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, false],
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
      expectedHits: [false, false, false],
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
      expectedHits: [false, false, false],
    },
    {
      name: 'Too frequent transactions with same userType - hit twice',
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
      expectedHits: [false, false, true, false, false, true],
    },
    {
      name: 'Too frequent transactions with different userType - not hit ',
      transactions: [
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-3',
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-4',
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-2',
          timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-3',
          timestamp: dayjs('2022-01-01T00:10:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '7-1',
          destinationUserId: '7-4',
          timestamp: dayjs('2022-01-01T00:10:02.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, false, false, false, false],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })

  describe('Optional parameter - Only check transactions from known users (with user ID)', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: {
          transactionsLimit: 1,
          timeWindow: {
            units: 60,
            granularity: 'second',
          },
          checkSender: 'sending',
          checkReceiver: 'receiving',
          onlyCheckKnownUsers: true,
        } as TransactionsVelocityRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Ignore non-user sending transactions',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: undefined,
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            timestamp: dayjs('2022-01-01T00:00:03.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Ignore non-user receiving transactions',
        transactions: [
          getTestTransaction({
            originUserId: '2-2',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-3',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:03.000Z').valueOf(),
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
})
