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

const DEFAULT_RULE_PARAMETERS: MultipleSendersWithinTimePeriodRuleParameters = {
  sendersCount: 2,
  timeWindow: {
    units: 30,
    granularity: 'day',
  },
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName:
        'multiple-counterparty-senders-within-time-period',
      defaultParameters: DEFAULT_RULE_PARAMETERS,
      defaultAction: 'FLAG',
    },
  ])

  describe('R-10 description formatting', () => {
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'description-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '20ac00fegf3ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'description-1',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '34gf00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: 'description-1',
          timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '98ju00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-10').descriptionTemplate,
      },
      [
        null,
        null,
        'More than 2 counterparties transacting with a single user over a set period of 30 days.',
      ]
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Transacting with different destinationUserID (within time period) - not hit',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '1-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'US',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '1-3',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: 'b5fe350d5135ab64a8f3c1097fadefd9effb',
            cardIssuedCountry: 'US',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '1-4',
          timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '18ac00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'US',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Transacting with different destinationUserID (not within time period) - not hit',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '12fc00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'GB',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '2-2',
          timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '12fc00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'GB',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '2-3',
          timestamp: dayjs('2022-03-03T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '12fc00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'GB',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Transacting with same destinationUserID (not within time period) - not hit',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '11ac00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'TR',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '3-2',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '20ac99fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'TR',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '3-2',
          timestamp: dayjs('2022-02-29T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '20ac00feg7ef913aefb17cfae1097cce',
            cardIssuedCountry: 'TR',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'Transacting with same destinationUserID (within time period) - hit',
      transactions: [
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '20ac00fegf3ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '34gf00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: undefined,
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '98ju00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
      ],
      expectedHits: [false, false, true],
    },
    {
      name: 'Transacting with same destinationUserID but with non counterParty sender (within time period) - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '20ac00fegf3ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: '1-2',
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '34gf00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
          },
        }),
        getTestTransaction({
          originUserId: '1-3',
          destinationUserId: '4-2',
          timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '98ju00fed8ef913aefb17cfae1097cce',
            cardIssuedCountry: 'CH',
            transactionReferenceField: 'DEPOSIT',
            '3dsDone': true,
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

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'multiple-counterparty-senders-within-time-period',
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
      originUserId: undefined,
      destinationUserId: '1',
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      originPaymentDetails: {
        method: 'CARD',
        cardFingerprint: '20ac00fed8ef913aefb17cfae1097cce',
        cardIssuedCountry: 'US',
      },
    }),
    getTestTransaction({
      originUserId: undefined,
      destinationUserId: '1',
      timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
      originPaymentDetails: {
        method: 'CARD',
        cardFingerprint: 'b5fe350d5135ab64a8f3c1097fadefd9effb',
        cardIssuedCountry: 'US',
      },
    }),
    getTestTransaction({
      originUserId: undefined,
      destinationUserId: '1',
      timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
      originPaymentDetails: {
        method: 'CARD',
        cardFingerprint: '18ac00fed8ef913aefb17cfae1097cce',
        cardIssuedCountry: 'US',
      },
    }),
  ],
  {
    origin: undefined,
    destination: [
      {
        senderKeys: [
          `${TEST_TENANT_ID}#transaction#type:all#paymentDetails#cardFingerprint:20ac00fed8ef913aefb17cfae1097cce#sending`,
        ],
        hour: '2022010100',
      },
      {
        senderKeys: [
          `${TEST_TENANT_ID}#transaction#type:all#paymentDetails#cardFingerprint:b5fe350d5135ab64a8f3c1097fadefd9effb#sending`,
        ],
        hour: '2022010300',
      },
      {
        senderKeys: [
          `${TEST_TENANT_ID}#transaction#type:all#paymentDetails#cardFingerprint:18ac00fed8ef913aefb17cfae1097cce#sending`,
        ],
        hour: '2022010400',
      },
    ],
  }
)
