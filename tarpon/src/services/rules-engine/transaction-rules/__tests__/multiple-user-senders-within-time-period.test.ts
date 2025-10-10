import { MultipleSendersWithinTimePeriodRuleParameters } from '../multiple-senders-within-time-period-base'
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
  testAggregationRebuild,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { setUpUsersHooks, getTestUser } from '@/test-utils/user-test-utils'

const DEFAULT_RULE_PARAMETERS: MultipleSendersWithinTimePeriodRuleParameters = {
  sendersCount: 2,
  timeWindow: {
    units: 30,
    granularity: 'day',
  },
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'multiple-user-senders-within-time-period',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({ userId: '2-1' }),
      getTestUser({ userId: '2-2' }),
      getTestUser({ userId: '2-3' }),
      getTestUser({ userId: '2-4' }),
      getTestUser({ userId: '1-1' }),
      getTestUser({ userId: '1-2' }),
      getTestUser({ userId: '1-3' }),
      getTestUser({ userId: '1-4' }),
      getTestUser({ userId: '3-1' }),
      getTestUser({ userId: '3-2' }),
      getTestUser({ userId: '3-3' }),
      getTestUser({ userId: '3-4' }),
    ])

    describe('R-9 description formatting', () => {
      testRuleDescriptionFormatting(
        'basic case',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '2-2',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-3',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-4',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-9').descriptionTemplate,
        },
        [
          null,
          null,
          'More than 2 users transacting with a single counterparty over a set period of 30 days.',
        ]
      )
    })

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Same sender user transacting with different destinationUserId (within time period) - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            timestamp: dayjs('2022-01-25T00:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Different sender user transacting with same destinationUserId (within time period) - hit',
        transactions: [
          getTestTransaction({
            originUserId: '2-2',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-3',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-4',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-5',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-05T00:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, true],
      },
      {
        name: 'Different sender user transacting with same originUserID (not within time period) - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '3-1',
            destinationUserId: '3-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '3-3',
            destinationUserId: '3-2',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '3-4',
            destinationUserId: '3-2',
            timestamp: dayjs('2022-02-29T00:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Same sender user transacting with same originUserID (within time period) - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '4-1',
            destinationUserId: '4-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '4-1',
            destinationUserId: '4-2',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '4-1',
            destinationUserId: '4-2',
            timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Different sender user transacting with different destinationUserId (within time period) - hit',
        transactions: [
          getTestTransaction({
            originUserId: '2-2',
            destinationUserId: '2-1-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-3',
            destinationUserId: '2-1-2',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-4',
            destinationUserId: '2-1-3',
            timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-5',
            destinationUserId: '2-1-4',
            timestamp: dayjs('2022-01-05T00:00:00.000Z').valueOf(),
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
})

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'multiple-user-senders-within-time-period',
    defaultParameters: {
      sendersCount: 2,
      timeWindow: {
        units: 30,
        granularity: 'day',
        rollingBasis: true,
      },
    },
  },
  [
    getTestTransaction({
      originUserId: '2',
      destinationUserId: '1',
      timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '3',
      destinationUserId: '1',
      timestamp: dayjs('2022-01-01T01:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '4',
      destinationUserId: '1',
      timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '3',
      destinationUserId: '1',
      timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: undefined,
    destination: [
      {
        senderKeys: [
          `${TEST_TENANT_ID}#transaction#type:all#user:3#sending`,
          `${TEST_TENANT_ID}#transaction#type:all#user:2#sending`,
        ],
        hour: '2022010101',
      },
      {
        senderKeys: [`${TEST_TENANT_ID}#transaction#type:all#user:4#sending`],
        hour: '2022010200',
      },
      {
        senderKeys: [`${TEST_TENANT_ID}#transaction#type:all#user:3#sending`],
        hour: '2022010300',
      },
    ],
  }
)
