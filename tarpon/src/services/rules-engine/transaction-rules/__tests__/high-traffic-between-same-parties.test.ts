import { HighTrafficBetweenSamePartiesParameters } from '../high-traffic-between-same-parties'
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
import { CardDetails } from '@/@types/openapi-public/CardDetails'

const DEFAULT_RULE_PARAMETERS: HighTrafficBetweenSamePartiesParameters = {
  timeWindow: {
    units: 1,
    granularity: 'day',
    rollingBasis: true,
  },
  transactionsLimit: 1,
}

dynamoDbSetupHook()

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

ruleVariantsTest({ aggregation: true }, () => {
  describe('R-119 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-traffic-between-same-parties',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])

    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          reference: 'First transaction 1 -> 2',
          originUserId: '1',
          destinationUserId: '2',
          timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          reference: 'Second transaction 1 -> 2',
          originUserId: '1',
          destinationUserId: '2',
          timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-119').descriptionTemplate,
      },
      [
        null,
        '1 transactions above the limit of 1 between same Sender and Receiver in 1 day.',
      ]
    )
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-traffic-between-same-parties',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Too many transactions of two non-anonymous users - hit',
        transactions: [
          getTestTransaction({
            reference: 'Too old transaction, should not be counted',
            originUserId: '1',
            destinationUserId: '2',
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'First transaction 1 -> 2',
            originUserId: '1',
            destinationUserId: '2',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Second transaction 1 -> 2',
            originUserId: '1',
            destinationUserId: '2',
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different origin user, should not be counted',
            originUserId: '111',
            destinationUserId: '2',
            timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different destination user, should not be counted',
            originUserId: '1',
            destinationUserId: '222',
            timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Third transaction 1->2, should be hit',
            originUserId: '1',
            destinationUserId: '2',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, false, false, true],
      },
      {
        name: 'Too many transactions of two anonymous users - hit',
        transactions: [
          getTestTransaction({
            reference: 'Too old transaction, should not be counted',
            originUserId: undefined,
            destinationUserId: undefined,
            originPaymentDetails: CARD_DETAILS_1,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'First transaction',
            originUserId: undefined,
            destinationUserId: undefined,
            originPaymentDetails: CARD_DETAILS_1,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Second transaction',
            originUserId: undefined,
            destinationUserId: undefined,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different origin user, should not be counted',
            originUserId: '111',
            destinationUserId: '2',
            timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different destination user, should not be counted',
            originUserId: '1',
            destinationUserId: '222',
            timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Third transaction, should be hit',
            originUserId: '1',
            destinationUserId: '2',
            originPaymentDetails: CARD_DETAILS_1,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false, false, false, true],
      },
      {
        name: 'Too many transactions of known origin and anonymous destination users - hit',
        transactions: [
          getTestTransaction({
            reference: 'Too old transaction, should not be counted',
            originUserId: '1',
            destinationUserId: undefined,
            originPaymentDetails: undefined,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'First transaction',
            originUserId: '1',
            destinationUserId: undefined,
            originPaymentDetails: undefined,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Second transaction',
            originUserId: '1',
            destinationUserId: undefined,
            originPaymentDetails: undefined,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different origin user, should not be counted',
            originUserId: '111',
            destinationUserId: '2',
            timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different destination user, should not be counted',
            originUserId: '1',
            destinationUserId: '222',
            timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Third transaction, should be hit',
            originUserId: '1',
            destinationUserId: undefined,
            originPaymentDetails: undefined,
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, false, false, true],
      },
      {
        name: 'Too many transactions of anonymous origin and known destination users - hit',
        transactions: [
          getTestTransaction({
            reference: 'Too old transaction, should not be counted',
            originUserId: undefined,
            destinationUserId: '2',
            originPaymentDetails: CARD_DETAILS_1,
            destinationPaymentDetails: undefined,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'First transaction',
            originUserId: undefined,
            destinationUserId: '2',
            originPaymentDetails: CARD_DETAILS_1,
            destinationPaymentDetails: undefined,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Second transaction',
            originUserId: undefined,
            destinationUserId: '2',
            originPaymentDetails: CARD_DETAILS_1,
            destinationPaymentDetails: undefined,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different origin user, should not be counted',
            originUserId: '111',
            destinationUserId: '2',
            timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference:
              'Transaction for different destination user, should not be counted',
            originUserId: '1',
            destinationUserId: '222',
            timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            reference: 'Third transaction, should be hit',
            originUserId: undefined,
            destinationUserId: '2',
            originPaymentDetails: CARD_DETAILS_1,
            destinationPaymentDetails: undefined,
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, false, false, true],
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
        ruleImplementationName: 'high-traffic-between-same-parties',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: true,
          },
          transactionsLimit: 2,
          originMatchPaymentMethodDetails: true,
        } as HighTrafficBetweenSamePartiesParameters,
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
            originPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-2',
            destinationUserId: '2-1',
            originPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-3',
            destinationUserId: '2-1',
            originPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-4',
            destinationUserId: '2-1',
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
        ruleImplementationName: 'high-traffic-between-same-parties',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: true,
          },
          transactionsLimit: 2,
          destinationMatchPaymentMethodDetails: true,
        } as HighTrafficBetweenSamePartiesParameters,
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
            destinationPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-2',
            destinationPaymentDetails: CARD_DETAILS_2,
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-3',
            destinationPaymentDetails: CARD_DETAILS_1,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '2-4',
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
    ruleImplementationName: 'high-traffic-between-same-parties',
    defaultParameters: DEFAULT_RULE_PARAMETERS,
    defaultAction: 'FLAG',
  },
  [
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '3',
      timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      destinationUserId: '2',
      timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      {
        [`${TEST_TENANT_ID}#transaction#type:all#user:2#receiving`]: 1,
        hour: '2022010102',
      },
      {
        [`${TEST_TENANT_ID}#transaction#type:all#user:3#receiving`]: 1,
        hour: '2022010103',
      },
      {
        [`${TEST_TENANT_ID}#transaction#type:all#user:2#receiving`]: 1,
        hour: '2022010104',
      },
    ],
    destination: undefined,
  }
)
