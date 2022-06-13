import dayjs from 'dayjs'
import { FirstActivityAfterLongTimeRuleParameters } from '../first-activity-after-time-period'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
dynamoDbSetupHook()

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
