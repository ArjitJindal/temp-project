import { SenderLocationChangesFrequencyRuleParameters } from '../sender-location-changes-frequency'
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
import { withFeatureHook } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()
withFeatureHook(['RULES_ENGINE_V2'])

ruleVariantsTest(true, () => {
  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'sender-location-changes-frequency',
        defaultParameters: {
          uniqueCitiesCountThreshold: 2,
          timeWindowInDays: 1,
        } as SenderLocationChangesFrequencyRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe('R-113 description formatting', () => {
      testRuleDescriptionFormatting(
        'basic case',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            deviceData: {
              // City: Sungai Petani
              ipAddress: '175.141.76.76',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            deviceData: {
              // City: Bourg-en-Bresse
              ipAddress: '176.135.186.17',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
            deviceData: {
              // City: Newcastle-under-Lyme
              ipAddress: '160.5.125.137',
            },
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-113').descriptionTemplate,
        },
        [
          null,
          null,
          'Sender made 3 transactions from 3 locations in more than 1 day(s).',
        ]
      )
    })

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Sender user changes cities too frequently - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            deviceData: {
              // City: Sungai Petani
              ipAddress: '175.141.76.76',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            deviceData: {
              // City: Bourg-en-Bresse
              ipAddress: '176.135.186.17',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
            deviceData: {
              // City: Newcastle-under-Lyme
              ipAddress: '160.5.125.137',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-03T12:00:00.000Z').valueOf(),
            deviceData: {
              // City: Rock Hill
              ipAddress: '67.197.77.43',
            },
          }),
        ],
        expectedHits: [false, false, true, false],
      },
      {
        name: 'Sender user in the same city - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '175.141.76.76',
            },
          }),
          getTestTransaction({
            originUserId: '2-1',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '175.141.76.77',
            },
          }),
          getTestTransaction({
            originUserId: '2-1',
            timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '175.141.76.78',
            },
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Sender user changes cities not too frequently - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '3-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '175.141.76.76',
            },
          }),
          getTestTransaction({
            originUserId: '3-1',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '176.135.186.17',
            },
          }),
          getTestTransaction({
            originUserId: '3-1',
            timestamp: dayjs('2022-01-06T00:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '160.5.125.137',
            },
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Different sender users in different cities - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '4-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '175.141.76.76',
            },
          }),
          getTestTransaction({
            originUserId: '4-2',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '176.135.186.17',
            },
          }),
          getTestTransaction({
            originUserId: '4-3',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            deviceData: {
              ipAddress: '160.5.125.137',
            },
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
})
