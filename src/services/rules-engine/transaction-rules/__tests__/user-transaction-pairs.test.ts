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

describe('With transaction type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'user-transaction-pairs',
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
    getTestUser({ userId: '4-1' }),
    getTestUser({ userId: '4-2' }),
    getTestUser({ userId: '4-3' }),
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too many user pairs: same transaction type - hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T13:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-10T13:00:00.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'FLAG', 'FLAG', 'ALLOW'],
    },
    {
      name: 'Too many user pairs: different transaction type - not hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'OTHER1',
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'OTHER2',
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Normal user pairs: same transaction type - no hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-05T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'No user pairs: same transaction type - no hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '4-1',
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          originUserId: '4-1',
          destinationUserId: '4-3',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
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

describe('Without transaction type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'user-transaction-pairs',
      defaultParameters: {
        userPairsThreshold: 1,
        timeWindowInSeconds: 86400,
      } as UserTransactionPairsRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  setUpConsumerUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1-1' }),
    getTestUser({ userId: '1-2' }),
    getTestUser({ userId: '2-1' }),
    getTestUser({ userId: '2-2' }),
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Too many user pairs - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T13:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-10T13:00:00.000Z').valueOf(),
        }),
      ],
      expectedActions: ['ALLOW', 'FLAG', 'FLAG', 'ALLOW'],
    },
    {
      name: 'Normal user pairs - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-05T00:00:00.000Z').valueOf(),
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
