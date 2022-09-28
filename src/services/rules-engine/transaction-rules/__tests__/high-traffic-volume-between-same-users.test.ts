import { HighTrafficVolumeBetweenSameUsersParameters } from '../high-traffic-volume-between-same-users'
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
import { PaymentDetails } from '@/@types/tranasction/payment-type'

const TEST_TRANSACTION_AMOUNT_100 = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const IBAN_PAYMENT_DETAILS: PaymentDetails = {
  method: 'IBAN',
  name: 'Rabindra Jadega',
}

const CARD_PAYMENT_DETAILS: PaymentDetails = {
  method: 'CARD',
}

dynamoDbSetupHook()

describe('R-126 description formatting', () => {
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
        transactionVolumeThreshold: { EUR: 250 },
      } as HighTrafficVolumeBetweenSameUsersParameters,
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
        deviceData: {
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
        deviceData: {
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
        deviceData: {
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
        deviceData: {
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
        deviceData: {
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
        deviceData: {
          ipAddress: '1.1.1.1',
        },
      }),
    ],
    {
      descriptionTemplate:
        '{{ format-money volumeDelta.transactionAmount volumeDelta.transactionCurrency }} above the threshold amount of {{ format-money volumeThreshold.transactionAmount volumeThreshold.transactionCurrency }} between two users',
    },
    [
      null,
      null,
      null,
      null,
      null,
      '50.00 EUR above the threshold amount of 250.00 EUR between two users',
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
          deviceData: {
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
          deviceData: {
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
          deviceData: {
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
          deviceData: {
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
          deviceData: {
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
          deviceData: {
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
          reference: 'First transaction 0 -> 100 between same users, count = 1',
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
          reference: 'Third transaction 200->300 between same users, count = 3',
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

describe('Core logic with Payment type filters', () => {
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
        paymentMethod: 'IBAN',
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
          originPaymentDetails: IBAN_PAYMENT_DETAILS,
          destinationPaymentDetails: IBAN_PAYMENT_DETAILS,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          deviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference: 'First transaction 0 -> 100 between same users',
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          originPaymentDetails: IBAN_PAYMENT_DETAILS,
          destinationPaymentDetails: IBAN_PAYMENT_DETAILS,
          timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          deviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference: 'Second transaction 100 -> 200 between same users',
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          originPaymentDetails: IBAN_PAYMENT_DETAILS,
          destinationPaymentDetails: IBAN_PAYMENT_DETAILS,
          timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          deviceData: {
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
          deviceData: {
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
          originPaymentDetails: IBAN_PAYMENT_DETAILS,
          destinationPaymentDetails: IBAN_PAYMENT_DETAILS,
          timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
          deviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
        getTestTransaction({
          reference:
            'Third transaction 200->300 between same users but card type, should not be hit',
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          originPaymentDetails: CARD_PAYMENT_DETAILS,
          destinationPaymentDetails: CARD_PAYMENT_DETAILS,
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          deviceData: {
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
          originPaymentDetails: IBAN_PAYMENT_DETAILS,
          destinationPaymentDetails: IBAN_PAYMENT_DETAILS,
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          deviceData: {
            ipAddress: '1.1.1.1',
          },
        }),
      ],
      expectedHits: [false, false, false, false, false, false, true],
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
