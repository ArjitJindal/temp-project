import { ConsecutiveTransactionSameTypeRuleParameters } from '../consecutive-transactions-same-type'
import { getTransactionRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

describe('Core logic', () => {
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'consecutive-transactions-same-type',
      defaultParameters: {
        targetTransactionsThreshold: 2,
        transactionTypes: ['DEPOSIT'],
        otherTransactionTypes: ['EXTERNAL_PAYMENT', 'EXTERNAL_PAYMENT'],
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
    getTestUser({ userId: 'description-1' }),
  ])

  describe('R-101 description formatting', () => {
    testRuleDescriptionFormatting(
      'sender',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: 'description-1',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: 'description-1',
          timestamp: dayjs('2022-01-05T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: 'description-1',
          timestamp: dayjs('2022-01-10T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: 'description-1',
          timestamp: dayjs('2022-01-20T06:00:00.000Z').valueOf(),
        }),
      ],
      {
        descriptionTemplate:
          getTransactionRuleByRuleId('R-101').descriptionTemplate,
      },
      [
        null,
        null,
        'Sender made 2 or more crypto transactions without any fiat transactions',
        'Sender made 2 or more crypto transactions without any fiat transactions',
      ]
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Consecutive transactions of the target type (w/o other types) - hit',
      transactions: [
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '1-1',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '1-1',
          timestamp: dayjs('2022-01-05T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '1-1',
          timestamp: dayjs('2022-01-10T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '1-1',
          timestamp: dayjs('2022-01-20T06:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, true, true],
    },
    {
      name: 'Consecutive transactions of the target type (with other types) - hit',
      transactions: [
        getTestTransaction({
          type: 'EXTERNAL_PAYMENT',
          originUserId: '2-1',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '2-1',
          timestamp: dayjs('2022-01-05T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '2-1',
          timestamp: dayjs('2022-01-10T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '2-1',
          timestamp: dayjs('2022-01-20T06:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, false, true],
    },
    {
      name: 'Non-consecutive transactions of the target type - not hit',
      transactions: [
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '3-1',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'EXTERNAL_PAYMENT',
          originUserId: '3-1',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '3-1',
          timestamp: dayjs('2022-01-05T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'EXTERNAL_PAYMENT',
          originUserId: '3-1',
          timestamp: dayjs('2022-01-06T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '3-1',
          timestamp: dayjs('2022-01-07T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'DEPOSIT',
          originUserId: '3-1',
          timestamp: dayjs('2022-01-07T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, false, false, false, false],
    },
    {
      name: 'Consecutive transactions of the non-target type - not hit',
      transactions: [
        getTestTransaction({
          type: 'EXTERNAL_PAYMENT',
          originUserId: '4-1',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'EXTERNAL_PAYMENT',
          originUserId: '4-1',
          timestamp: dayjs('2022-01-05T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'EXTERNAL_PAYMENT',
          originUserId: '4-1',
          timestamp: dayjs('2022-01-10T06:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          type: 'EXTERNAL_PAYMENT',
          originUserId: '4-1',
          timestamp: dayjs('2022-01-20T06:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, false, false],
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
