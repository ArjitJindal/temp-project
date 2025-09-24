import reduce from 'lodash/reduce'
import { TooManyUsersForSamePaymentIdentifierParameters } from '../too-many-users-for-same-payment-identifier'
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
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { PaymentMethod } from '@/@types/openapi-internal/PaymentMethod'

const DEFAULT_RULE_PARAMETERS: TooManyUsersForSamePaymentIdentifierParameters =
  {
    uniqueUsersCountThreshold: 1,
    timeWindow: {
      units: 1,
      granularity: 'day',
    },
  }

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true }, () => {
  describe('R-53 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'too-many-users-for-same-payment-identifier',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        }),
        getTestTransaction({
          originUserId: '2',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-53').descriptionTemplate,
      },
      [
        null,
        'Same unique payment identifier (Card Fingerprint: 123) used by 2 unique users.',
      ]
    )
  })
  describe('core logic using card payment', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'too-many-users-for-same-payment-identifier',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])
    describe.each<TransactionRuleTestCase>([
      {
        name: 'Different users using the same card in short time - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
          getTestTransaction({
            originUserId: '2',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Different users using the different payment method in short time - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
          getTestTransaction({
            originUserId: '2',
            timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'UPI',
              upiID: '123',
            },
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Different users using the same card not in short time - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
          getTestTransaction({
            originUserId: '2',
            timestamp: dayjs('2022-01-06T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Different users using the different card - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
          getTestTransaction({
            originUserId: '2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '456',
            },
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Same users using the same card - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Undefined user ID with same card - not hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
          getTestTransaction({
            originUserId: undefined,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Undefined user ID with different card - not hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '123',
            },
          }),
          getTestTransaction({
            originUserId: undefined,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: '456',
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
  })
  PAYMENT_METHODS.forEach((paymentMethod) => {
    describe(`Testing ${paymentMethod} method`, () => {
      const TEST_TENANT_ID = getTestTenantId()
      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'too-many-users-for-same-payment-identifier',
          defaultParameters: {
            uniqueUsersCountThreshold: 1,
            timeWindow: {
              units: 1,
              granularity: 'day',
            },
          } as TooManyUsersForSamePaymentIdentifierParameters,
          defaultAction: 'FLAG',
        },
      ])
      describe.each<TransactionRuleTestCase>([
        {
          name: 'Different users using the same payment details in short time - hit',
          transactions: [
            getTestTransaction({
              originUserId: '1',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
              originPaymentDetails: samplePaymentDetails(paymentMethod, '123'),
            }),
            getTestTransaction({
              originUserId: '2',
              timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
              originPaymentDetails: samplePaymentDetails(paymentMethod, '123'),
            }),
          ],
          expectedHits: [false, true],
        },
        {
          name: 'Different users using  different payment details in short time - not hit',
          transactions: [
            getTestTransaction({
              originUserId: '1',
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
              originPaymentDetails: samplePaymentDetails(paymentMethod, '123'),
            }),
            getTestTransaction({
              originUserId: '2',
              timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
              originPaymentDetails: samplePaymentDetails(paymentMethod, '345'),
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
    })
  })
})

function samplePaymentDetails(paymentMethod: PaymentMethod, value: string) {
  return {
    method: paymentMethod,
    ...reduce(
      PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentMethod],
      (_, val) => {
        return { ..._, [val]: value }
      },
      {}
    ),
  } as PaymentDetails
}

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'too-many-users-for-same-payment-identifier',
    defaultParameters: {
      uniqueUsersCountThreshold: 1,
      timeWindow: {
        units: 1,
        granularity: 'day',
        rollingBasis: true,
      },
    },
  },
  [
    getTestTransaction({
      originUserId: '1',
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      originPaymentDetails: {
        method: 'CARD',
        cardFingerprint: '123',
      },
    }),
    getTestTransaction({
      originUserId: '2',
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
      originPaymentDetails: {
        method: 'CARD',
        cardFingerprint: '123',
      },
    }),
    getTestTransaction({
      originUserId: '3',
      timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
      originPaymentDetails: {
        method: 'CARD',
        cardFingerprint: '123',
      },
    }),
  ],
  {
    origin: [
      { userIds: ['2', '1'], hour: '2022010100' },
      { userIds: ['3'], hour: '2022010101' },
    ],
    destination: undefined,
  }
)
