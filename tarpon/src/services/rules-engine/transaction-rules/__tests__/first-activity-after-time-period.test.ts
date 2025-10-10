import { FirstActivityAfterLongTimeRuleParameters } from '../first-activity-after-time-period'
import { getRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
  ruleVariantsTest,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: false, v8: true }, () => {
  describe('R-5 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'first-activity-after-time-period',
        defaultParameters: {
          dormancyPeriodDays: 365,
          checkDirection: 'sending',
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
        descriptionTemplate: getRuleByRuleId('R-5').descriptionTemplate,
      },
      [
        null,
        'User made a transaction from an account which was dormant for 365 days.',
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
          checkDirection: 'sending',
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
            timestamp: dayjs('2021-01-01T00:00:01.000Z').valueOf(),
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

  describe('Check sending', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'first-activity-after-time-period',
        defaultParameters: {
          dormancyPeriodDays: 365,
          checkDirection: 'sending',
        } as FirstActivityAfterLongTimeRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'only check sending transactions',
        transactions: [
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-2',
            timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-3',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-02-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-2',
            timestamp: dayjs('2022-02-01T00:00:00.000Z').valueOf(),
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

  describe('Check both sending and receiving', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'first-activity-after-time-period',
        defaultParameters: {
          dormancyPeriodDays: 365,
          checkDirection: 'all',
        } as FirstActivityAfterLongTimeRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'check both sending and receiving transactions',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            destinationUserId: '1',
            timestamp: dayjs('2021-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '3',
            timestamp: dayjs('2022-02-01T00:00:00.000Z').valueOf(),
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
})
