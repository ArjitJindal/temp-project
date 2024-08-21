import { IpAddressUnexpectedLocationRuleParameters } from '../ip-address-unexpected-location'
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
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'

const TEST_IP_LOOKUPS = {
  '18.184.45.226': 'DE',
  '49.136.0.0': 'IN',
  '109.228.192.0': 'TR',
  '24.184.45.226': 'AU',
  '14.228.192.0': 'US',
}
jest.mock('@/services/geo-ip', () => ({
  GeoIPService: jest.fn().mockImplementation(() => ({
    resolveIpAddress: jest.fn((ip: string) => {
      return Promise.resolve({ country: TEST_IP_LOOKUPS[ip] })
    }),
  })),
}))

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: false }, () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'ip-address-unexpected-location',
      defaultParameters: {
        transactionAmountThreshold: { EUR: 500 },
      } as IpAddressUnexpectedLocationRuleParameters,
      defaultAction: 'FLAG',
    },
  ])
  setUpUsersHooks(TEST_TENANT_ID, [
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

  describe('R-88 description formatting', () => {
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '3',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Germany ip address
            ipAddress: '18.184.45.226',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-88').descriptionTemplate,
      },
      [
        'Sender’s ip-bases country (Germany) is not country of origin (India) or country of nationality (Türkiye).',
      ]
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: "User's ip country is not in the user's residence/nationality country  - hit",
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Germany ip address
            ipAddress: '18.184.45.226',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: "User's ip country is in the countries of the user's previous approved transactions  - hit",
      transactions: [
        getTestTransaction({
          transactionState: 'CREATED',
          originUserId: '2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Germany ip address
            ipAddress: '18.184.45.226',
          },
        }),
        getTestTransaction({
          transactionState: 'SUCCESSFUL',
          originUserId: '2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Germany ip address
            ipAddress: '18.184.45.226',
          },
        }),
        getTestTransaction({
          originUserId: '2',
          timestamp: dayjs('2022-01-01T00:00:10.000Z').valueOf(),
          originDeviceData: {
            // A Germany ip address
            ipAddress: '18.184.45.226',
          },
        }),
      ],
      expectedHits: [true, true, false],
    },
    {
      name: "User's ip country is in the user's residence country - not hit",
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A India ip address
            ipAddress: '49.136.0.0',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: "User's ip country is in the user's nationality country - not hit",
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Tukey ip address
            ipAddress: '109.228.192.0',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Invalid ip address - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            ipAddress: 'bad.ip.address',
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'No ip address - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: undefined,
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount is below the threshhold value with different IP address - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Germany ip address
            ipAddress: '18.184.45.226',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 250,
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount is below the threshhold value with same IP address - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Tukey ip address
            ipAddress: '109.228.192.0',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 250,
          },
        }),
      ],
      expectedHits: [false],
    },
    {
      name: 'Transaction amount exceeds the threshhold value with different IP address - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Random ip address
            ipAddress: '24.184.45.226',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 2500,
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'Transaction amount exceeds the threshhold value with same IP address - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originDeviceData: {
            // A Tukey ip address
            ipAddress: '109.228.192.0',
          },
          originAmountDetails: {
            transactionCurrency: 'EUR',
            transactionAmount: 2500,
          },
        }),
      ],
      expectedHits: [false],
    },
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })

  describe('Undefined Transaction Amount threshold', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'ip-address-unexpected-location',
        defaultAction: 'FLAG',
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
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
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Undefined transaction amount threshold with random IP address  - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originDeviceData: {
              // A Random ip address
              ipAddress: '14.228.192.0',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'Undefined transaction amount threshold with same IP address  - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originDeviceData: {
              // A Tukey ip address
              ipAddress: '109.228.192.0',
            },
          }),
        ],
        expectedHits: [false],
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
