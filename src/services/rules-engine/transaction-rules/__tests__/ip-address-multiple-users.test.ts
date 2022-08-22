import { IpAddressMultipleUsersRuleParameters } from '../ip-address-multiple-users'
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

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'ip-address-multiple-users',
    defaultParameters: {
      uniqueUsersCountThreshold: 1,
      timeWindowInDays: 1,
    } as IpAddressMultipleUsersRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe('R-52 description formatting', () => {
  const descriptionTemplate = `Same ip address ({{ ipAddress }}) used by {{ uniqueUsersCount }} unique users`

  testRuleDescriptionFormatting(
    'basic case',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
    ],
    {
      descriptionTemplate,
    },
    [null, null, 'Same ip address (1.1.1.1) used by 2 unique users']
  )
})

describe.each<TransactionRuleTestCase>([
  {
    name: 'Different users using the same IP address in a short time - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-01T07:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '3',
        timestamp: dayjs('2022-01-07T07:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
    ],
    expectedHits: [false, false, true, true, false],
  },
  {
    name: 'Different users using the same IP address not in a short time - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '2.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-07T00:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '2.1.1.1',
        },
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'Same user using the same IP address - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '3.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '3.1.1.1',
        },
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'Different users using different IP addresses - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '4.1.1.1',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: '4.2.1.1',
        },
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
