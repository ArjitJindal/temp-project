import { getRuleByRuleId } from '../library'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  TransactionRuleTestCase,
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import dayjs from '@/utils/dayjs'

const TEST_IP_LOOKUPS = {
  '18.184.45.226': 'DE',
  '115.240.90.163': 'IN',
}
jest.mock('@/services/geo-ip', () => ({
  GeoIPService: jest.fn().mockImplementation(() => ({
    resolveIpAddress: jest.fn((ip: string) => {
      return Promise.resolve({ country: TEST_IP_LOOKUPS[ip] })
    }),
    hydrateIpInfo: jest.fn((_transaction: any) => undefined),
  })),
}))

dynamoDbSetupHook()

describe('testttt', () => {
  ruleVariantsTest({ aggregation: false, v8: true }, () => {
    const TENANT_ID = getTestTenantId()

    setUpRulesHooks(TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-risk-ip-address-countries',
        defaultParameters: {
          highRiskCountries: ['TR', 'DE'],
        },
        defaultAction: 'FLAG',
      },
    ])

    setUpUsersHooks(TENANT_ID, [
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
      getTestUser({
        userId: '3',
        userDetails: {
          name: {
            firstName: '1',
          },
          countryOfResidence: 'IN',
          countryOfNationality: 'TR',
        },
      }),
    ])

    describe('R-87 description formatting', () => {
      testRuleDescriptionFormatting(
        'basic case',
        TENANT_ID,
        [
          getTestTransaction({
            originUserId: '3',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originDeviceData: {
              // A Germany ip address
              ipAddress: '18.184.45.226',
            },
          }),
          getTestTransaction({
            originUserId: '3',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            destinationDeviceData: {
              // A Germany ip address
              ipAddress: '18.184.45.226',
            },
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-87').descriptionTemplate,
        },
        [
          'Sender’s ip-bases country (Germany) is a High Risk.',
          'Receiver’s ip-bases country (Germany) is a High Risk.',
        ]
      )
    })

    describe.each<TransactionRuleTestCase>([
      {
        name: 'origin ip address is in a high risk country is not flagged',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originDeviceData: {
              // India ip address
              ipAddress: '115.240.90.163',
            },
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'destination ip address is in a high risk country is not flagged',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            destinationDeviceData: {
              // India ip address
              ipAddress: '115.240.90.163',
            },
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'origin ip address is in a high risk country is flagged',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originDeviceData: {
              // Germany ip address
              ipAddress: '18.184.45.226',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'destination ip address is in a high risk country is flagged',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            destinationDeviceData: {
              // Germany ip address
              ipAddress: '18.184.45.226',
            },
          }),
        ],
        expectedHits: [true],
      },
    ])('R-87: High risk countries', ({ expectedHits, name, transactions }) => {
      createTransactionRuleTestCase(name, TENANT_ID, transactions, expectedHits)
    })
  })
})
