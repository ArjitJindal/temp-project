import dayjs from 'dayjs'
import { SenderLocationChangesFrequencyRuleParameters } from '../sender-location-changes-frequency'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createRuleTestCase,
  RuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    ruleImplementationName: 'sender-location-changes-frequency',
    defaultParameters: {
      uniqueCitiesCountThreshold: 2,
      timeWindowInDays: 1,
    } as SenderLocationChangesFrequencyRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<RuleTestCase>([
  {
    name: 'Sender user changes cities too frequently - hit',
    transactions: [
      getTestTransaction({
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        deviceData: {
          // City: Sungai Petani
          ipAddress: '175.141.76.76',
        },
      }),
      getTestTransaction({
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').unix(),
        deviceData: {
          // City: Bourg-en-Bresse
          ipAddress: '176.135.186.17',
        },
      }),
      getTestTransaction({
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-01T12:00:00.000Z').unix(),
        deviceData: {
          // City: Newcastle-under-Lyme
          ipAddress: '160.5.125.137',
        },
      }),
      getTestTransaction({
        senderUserId: '1-1',
        timestamp: dayjs('2022-01-03T12:00:00.000Z').unix(),
        deviceData: {
          // City: Rock Hill
          ipAddress: '67.197.77.43',
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG', 'ALLOW'],
  },
  {
    name: 'Sender user in the same city - not hit',
    transactions: [
      getTestTransaction({
        senderUserId: '2-1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '175.141.76.76',
        },
      }),
      getTestTransaction({
        senderUserId: '2-1',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '175.141.76.77',
        },
      }),
      getTestTransaction({
        senderUserId: '2-1',
        timestamp: dayjs('2022-01-01T12:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '175.141.76.78',
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Sender user changes cities not too frequently - not hit',
    transactions: [
      getTestTransaction({
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '175.141.76.76',
        },
      }),
      getTestTransaction({
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-03T00:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '176.135.186.17',
        },
      }),
      getTestTransaction({
        senderUserId: '3-1',
        timestamp: dayjs('2022-01-06T00:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '160.5.125.137',
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
  {
    name: 'Different sender users in different cities - not hit',
    transactions: [
      getTestTransaction({
        senderUserId: '4-1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '175.141.76.76',
        },
      }),
      getTestTransaction({
        senderUserId: '4-2',
        timestamp: dayjs('2022-01-01T01:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '176.135.186.17',
        },
      }),
      getTestTransaction({
        senderUserId: '4-3',
        timestamp: dayjs('2022-01-01T02:00:00.000Z').unix(),
        deviceData: {
          ipAddress: '160.5.125.137',
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createRuleTestCase(name, TEST_TENANT_ID, transactions, expectedActions)
})
