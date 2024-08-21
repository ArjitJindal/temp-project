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
  testAggregationRebuild,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const DEFAULT_RULE_PARAMETERS: SenderLocationChangesFrequencyRuleParameters = {
  uniqueCitiesCountThreshold: 2,
  timeWindow: {
    units: 1,
    granularity: 'day',
    rollingBasis: true,
  },
}

const TEST_IP_LOOKUPS = {
  '18.184.45.226': 'Berlin',
  '49.136.0.0': 'Mumbai',
  '109.228.192.0': 'Istanbul',
  '24.184.45.226': 'Sydney',
  '14.228.192.0': 'New York',
}
jest.mock('@/services/geo-ip', () => ({
  GeoIPService: jest.fn().mockImplementation(() => ({
    resolveIpAddress: jest.fn((ip: string) => {
      return Promise.resolve({ city: TEST_IP_LOOKUPS[ip] })
    }),
  })),
}))

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true }, () => {
  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'sender-location-changes-frequency',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
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
            originDeviceData: {
              // City: Berlin
              ipAddress: '18.184.45.226',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            originDeviceData: {
              // City: Mumbai
              ipAddress: '49.136.0.0',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
            originDeviceData: {
              // City: Istanbul
              ipAddress: '109.228.192.0',
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
            originDeviceData: {
              // City: Berlin
              ipAddress: '18.184.45.226',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            originDeviceData: {
              // City: Mumbai
              ipAddress: '176.135.186.17',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
            originDeviceData: {
              // City: Istanbul
              ipAddress: '109.228.192.0',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            timestamp: dayjs('2022-01-03T12:00:00.000Z').valueOf(),
            originDeviceData: {
              // City: New York
              ipAddress: '14.228.192.0',
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
            originDeviceData: {
              ipAddress: '14.228.192.0',
            },
          }),
          getTestTransaction({
            originUserId: '2-1',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '14.228.192.0',
            },
          }),
          getTestTransaction({
            originUserId: '2-1',
            timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '14.228.192.0',
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
            originDeviceData: {
              ipAddress: '14.228.192.0',
            },
          }),
          getTestTransaction({
            originUserId: '3-1',
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '18.184.45.226',
            },
          }),
          getTestTransaction({
            originUserId: '3-1',
            timestamp: dayjs('2022-01-06T00:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '24.184.45.226',
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
            originDeviceData: {
              ipAddress: '24.184.45.226',
            },
          }),
          getTestTransaction({
            originUserId: '4-2',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '18.184.45.226',
            },
          }),
          getTestTransaction({
            originUserId: '4-3',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '14.228.192.0',
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

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'sender-location-changes-frequency',
    defaultParameters: DEFAULT_RULE_PARAMETERS,
  },
  [
    getTestTransaction({
      originUserId: '1-1',
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      originDeviceData: {
        // City: Berlin
        ipAddress: '18.184.45.226',
      },
    }),
    getTestTransaction({
      originUserId: '1-1',
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
      originDeviceData: {
        // City: Mumbai
        ipAddress: '49.136.0.0',
      },
    }),
    getTestTransaction({
      originUserId: '1-1',
      timestamp: dayjs('2022-01-01T12:00:00.000Z').valueOf(),
      originDeviceData: {
        // City: Istanbul
        ipAddress: '109.228.192.0',
      },
    }),
  ],
  {
    origin: [
      {
        ipAddresses: ['49.136.0.0', '18.184.45.226'],
        transactionsCount: 2,
        hour: '2022010100',
      },
      {
        ipAddresses: ['109.228.192.0'],
        transactionsCount: 1,
        hour: '2022010112',
      },
    ],
    destination: undefined,
  }
)
