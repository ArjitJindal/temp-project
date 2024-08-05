import { HighTrafficVolumeBetweenSameUsersParameters } from '../high-traffic-volume-between-same-users'
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
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { CardDetails } from '@/@types/openapi-public/CardDetails'

const CARD_DETAILS_1: CardDetails = {
  method: 'CARD',
  cardFingerprint: '11111111111111111111111111111111',
  cardIssuedCountry: 'US',
  transactionReferenceField: 'DEPOSIT',
  '3dsDone': true,
}
const CARD_DETAILS_2: CardDetails = {
  method: 'CARD',
  cardFingerprint: '22222222222222222222222222222222',
  cardIssuedCountry: 'IN',
  transactionReferenceField: 'DEPOSIT',
  '3dsDone': true,
}
const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}
const DEFAULT_RULE_PARAMETERS: HighTrafficVolumeBetweenSameUsersParameters = {
  timeWindow: {
    units: 1,
    granularity: 'day',
  },
  transactionVolumeThreshold: { EUR: 250 },
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true }, () => {
  describe('R-126 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-traffic-volume-between-same-users',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])

    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          reference: 'Too old transaction, should not be counted',
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          originDeviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference: 'First transaction 0 -> 100 between same users',
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          originDeviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference: 'Second transaction 100 -> 200 between same users',
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          originDeviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference:
            'Transaction for different origin user, should not be counted',
          originUserId: '111',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
          originDeviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference:
            'Transaction for different destination user, should not be counted',
          originUserId: '1',
          destinationUserId: '222',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
          originDeviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference:
            'Third transaction 200->300 between same users, should be hit',
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originDeviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-126').descriptionTemplate,
      },
      [
        null,
        null,
        null,
        null,
        null,
        'Transaction volume 50.00 EUR above their expected amount of 250.00 EUR between two users in 1 day.',
      ]
    )
  })

  describe('Core logic with no filters', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-traffic-volume-between-same-users',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          transactionVolumeThreshold: { USD: 250 },
        } as HighTrafficVolumeBetweenSameUsersParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'transactions volume too high for 2 users - hit',
        transactions: [
          getTestTransaction({
            reference: 'Too old transaction, should not be counted',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '1.1.1.1',
            },
          }),
          getTestTransaction({
            reference: 'First transaction 0 -> 100 between same users',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '1.1.1.1',
            },
          }),
          getTestTransaction({
            reference: 'Second transaction 100 -> 200 between same users',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '1.1.1.1',
            },
          }),
          getTestTransaction({
            reference:
              'Transaction for different origin user, should not be counted',
            originUserId: '111',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '1.1.1.1',
            },
          }),
          getTestTransaction({
            reference:
              'Transaction for different destination user, should not be counted',
            originUserId: '1',
            destinationUserId: '222',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '1.1.1.1',
            },
          }),
          getTestTransaction({
            reference:
              'Third transaction 200->300 between same users, should be hit',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            originDeviceData: {
              ipAddress: '1.1.1.1',
            },
          }),
        ],
        expectedHits: [false, false, false, false, false, true],
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

  describe('Core logic with transactions count threshold', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-traffic-volume-between-same-users',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          transactionVolumeThreshold: { USD: 100 },
          transactionsLimit: 2,
        } as HighTrafficVolumeBetweenSameUsersParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'transactions volume AND count too high for 2 users - hit',
        transactions: [
          getTestTransaction({
            reference:
              'First transaction 0 -> 100 between same users, count = 1',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Second transaction 100 -> 200 between same users, count = 2',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Third transaction 200->300 between same users, count = 3',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
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

  describe('Match Payment Method Details (origin)', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-traffic-volume-between-same-users',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: true,
          },
          transactionVolumeThreshold: { USD: 250 },
          originMatchPaymentMethodDetails: true,
        } as HighTrafficVolumeBetweenSameUsersParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Skip transactions with non-target paymentMethod',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-2',
            destinationUserId: '2-1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-3',
            destinationUserId: '2-1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-4',
            destinationUserId: '2-1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false, true],
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

  describe('Match Payment Method Details (destination)', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-traffic-volume-between-same-users',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: true,
          },
          transactionVolumeThreshold: { USD: 250 },
          destinationMatchPaymentMethodDetails: true,
        } as HighTrafficVolumeBetweenSameUsersParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Skip transactions with non-target paymentMethod',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-3',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-4',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false, true],
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
    ruleImplementationName: 'high-traffic-volume-between-same-users',
    defaultParameters: {
      timeWindow: {
        units: 1,
        granularity: 'day',
        rollingBasis: true,
      },
      transactionVolumeThreshold: { EUR: 250 },
    },
  },
  [
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T02:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
      timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      {
        [`${TEST_TENANT_ID}#transaction#type:all#user:2#receiving`]: 200,
        hour: '2022010102',
      },
      {
        [`${TEST_TENANT_ID}#transaction#type:all#user:2#receiving`]: 100,
        hour: '2022010103',
      },
    ],
    destination: undefined,
  }
)
