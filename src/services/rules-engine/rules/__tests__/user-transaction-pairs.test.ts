import dayjs from 'dayjs'
import { UserTransactionPairsRuleParameters } from '../user-transaction-pairs'
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

describe('With transaction type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      ruleImplementationFilename: 'user-transaction-pairs',
      defaultParameters: {
        userPairsThreshold: 1,
        timeWindowInDays: 1,
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

  describe.each<RuleTestCase>([
    {
      name: 'Too many user pairs: same transaction type - hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T13:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-10T13:00:00.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'FLAG', 'FLAG', 'ALLOW'],
    },
    {
      name: 'Too many user pairs: different transaction type - not hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '2-1',
          receiverUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'OTHER1',
          senderUserId: '2-1',
          receiverUserId: '2-2',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'OTHER2',
          senderUserId: '2-1',
          receiverUserId: '2-2',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'Normal user pairs: same transaction type - no hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '3-1',
          receiverUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '3-1',
          receiverUserId: '3-2',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '3-1',
          receiverUserId: '3-2',
          timestamp: dayjs('2022-01-05T00:00:00.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
    {
      name: 'No user pairs: same transaction type - no hit',
      transactions: [
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '4-1',
          receiverUserId: '4-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          type: 'MATCH_ORDER',
          senderUserId: '4-1',
          receiverUserId: '4-3',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW'],
    },
  ])('', ({ name, transactions, expectedActions }) => {
    createRuleTestCase(name, TEST_TENANT_ID, transactions, expectedActions)
  })
})

describe('Without transaction type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      ruleImplementationFilename: 'user-transaction-pairs',
      defaultParameters: {
        userPairsThreshold: 1,
        timeWindowInDays: 1,
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

  describe.each<RuleTestCase>([
    {
      name: 'Too many user pairs - hit',
      transactions: [
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T12:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-01T13:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '1-1',
          receiverUserId: '1-2',
          timestamp: dayjs('2022-01-10T13:00:00.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'FLAG', 'FLAG', 'ALLOW'],
    },
    {
      name: 'Normal user pairs - not hit',
      transactions: [
        getTestTransaction({
          senderUserId: '2-1',
          receiverUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '2-1',
          receiverUserId: '2-2',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').unix(),
        }),
        getTestTransaction({
          senderUserId: '2-1',
          receiverUserId: '2-2',
          timestamp: dayjs('2022-01-05T00:00:00.000Z').unix(),
        }),
      ],
      expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
    },
  ])('', ({ name, transactions, expectedActions }) => {
    createRuleTestCase(name, TEST_TENANT_ID, transactions, expectedActions)
  })
})
