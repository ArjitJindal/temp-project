import { FirstActivityAfterLongTimeRuleParameters } from '../first-activity-after-time-period'
import { getTransactionRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
dynamoDbSetupHook()

describe('R-5 description formatting', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'first-activity-after-time-period',
      defaultParameters: {
        dormancyPeriodDays: 365,
      } as FirstActivityAfterLongTimeRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-02T00:00:01.000Z').valueOf(),
      }),
    ],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-5').descriptionTemplate,
    },
    [
      null,
      'User made a transaction from an account which was dormant for 365 days',
    ]
  )
})

describe('Core logic', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'first-activity-after-time-period',
      defaultParameters: {
        dormancyPeriodDays: 365,
      } as FirstActivityAfterLongTimeRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: '1 day before exceeded dormacy period with same receiver- not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false],
    },
    {
      name: 'exceeded dormacy period with different receiver - hit',
      transactions: [
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-3',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '3-1',
          destinationUserId: '3-3',
          timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false, false, false],
    },
    {
      name: 'exceeded dormacy period with same receiver - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-02T00:00:01.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true],
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

describe('Transaction State', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'first-activity-after-time-period',
      defaultParameters: {
        dormancyPeriodDays: 365,
        transactionState: 'SUCCESSFUL',
      } as FirstActivityAfterLongTimeRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Skip transactions with non-target state',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-02T00:00:01.000Z').valueOf(),
          transactionState: 'DECLINED',
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-02T00:00:03.000Z').valueOf(),
          transactionState: 'SUCCESSFUL',
        }),
      ],
      expectedHits: [false, true, true],
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

describe('Optional parameters - User Type', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'first-activity-after-time-period',
      defaultParameters: {
        dormancyPeriodDays: 365,
        userType: 'CONSUMER',
      } as FirstActivityAfterLongTimeRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  setUpConsumerUsersHooks(TEST_TENANT_ID, [
    getTestUser({ userId: '1' }),
    getTestUser({ userId: '2' }),
    getTestUser({ userId: '3' }),
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Exceeded dormacy period with Comsumer user - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, true],
    },
    {
      name: 'Not exceeded dormacy period with Comsumer user - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          timestamp: dayjs('2021-01-02T00:00:00.000Z').valueOf(),
        }),
      ],
      expectedHits: [false, false],
    },
    {
      name: 'Exceeded dormacy period with Business user - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '6',
          destinationUserId: '7',
          timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '6',
          destinationUserId: '8',
          timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
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
