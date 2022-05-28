import dayjs from 'dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestUser,
  setUpConsumerUsersHooks,
} from '@/test-utils/user-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'ip-address-unexpected-location',
    defaultAction: 'FLAG',
  },
])
setUpConsumerUsersHooks(TEST_TENANT_ID, [
  getTestUser({
    userId: '1',
    userDetails: {
      name: {
        firstName: '1',
      },
      countryOfResidence: 'IN',
      countryOfNationality: 'TR',
    },
  }),
  getTestUser({
    userId: '2',
    userDetails: {
      name: {
        firstName: '1',
      },
    },
  }),
])

describe.each<TransactionRuleTestCase>([
  {
    name: "User's ip country is not in the user's residence/nationality country  - hit",
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          // A Germany ip address
          ipAddress: '18.184.45.226',
        },
      }),
    ],
    expectedActions: ['FLAG'],
  },
  {
    name: "User's ip country is in the countries of the user's previous approved transactions  - hit",
    transactions: [
      getTestTransaction({
        transactionState: 'CREATED',
        originUserId: '2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          // A Germany ip address
          ipAddress: '18.184.45.226',
        },
      }),
      getTestTransaction({
        transactionState: 'SUCCESSFUL',
        originUserId: '2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          // A Germany ip address
          ipAddress: '18.184.45.226',
        },
      }),
      getTestTransaction({
        originUserId: '2',
        timestamp: dayjs('2022-01-01T00:00:10.000Z').valueOf(),
        deviceData: {
          // A Germany ip address
          ipAddress: '18.184.45.226',
        },
      }),
    ],
    expectedActions: ['FLAG', 'FLAG', 'ALLOW'],
  },
  {
    name: "User's ip country is in the user's residence country - not hit",
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          // A India ip address
          ipAddress: '49.136.0.0',
        },
      }),
    ],
    expectedActions: ['ALLOW'],
  },
  {
    name: "User's ip country is in the user's nationality country - not hit",
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          // A Tukey ip address
          ipAddress: '109.228.192.0',
        },
      }),
    ],
    expectedActions: ['ALLOW'],
  },
  {
    name: 'Invalid ip address - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: {
          ipAddress: 'bad.ip.address',
        },
      }),
    ],
    expectedActions: ['ALLOW'],
  },
  {
    name: 'No ip address - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        deviceData: undefined,
      }),
    ],
    expectedActions: ['ALLOW'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedActions
  )
})
