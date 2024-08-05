import { getRuleByRuleId } from '../library'
import { SameUserUsingTooManyPaymentIdentifiersParameters } from '../same-user-using-too-many-payment-identifiers'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  ruleVariantsTest,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testAggregationRebuild,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()
const DEFAULT_RULE_PARAMETERS: SameUserUsingTooManyPaymentIdentifiersParameters =
  {
    uniquePaymentIdentifiersCountThreshold: 1,
    timeWindow: {
      units: 1,
      granularity: 'day',
    },
  }

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'same-user-using-too-many-payment-identifiers',
    defaultParameters: DEFAULT_RULE_PARAMETERS,
    defaultAction: 'FLAG',
  },
])

ruleVariantsTest({ aggregation: true }, () => {
  describe('R-55 description formatting', () => {
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '1-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        }),
        getTestTransaction({
          originUserId: '1-1',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'IBAN',
            IBAN: '123',
            bankName: '123',
            BIC: '123',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-55').descriptionTemplate,
      },
      [null, 'Sender used 2 unique payment identifiers above the limit of 1.']
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Same users using different identifiers - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        }),
        getTestTransaction({
          originUserId: '1-1',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CHECK',
            checkIdentifier: '456',
          },
        }),
      ],
      expectedHits: [false, true],
    },
    {
      name: 'Different users using different cards - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        }),
        getTestTransaction({
          originUserId: '2-2',
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
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
          originUserId: '3-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        }),
        getTestTransaction({
          originUserId: '3-1',
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
      name: 'Different users using the same card - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '4-1',
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'CARD',
            cardFingerprint: '123',
          },
        }),
        getTestTransaction({
          originUserId: '4-2',
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
      name: 'Undefined originUserID with same card - not hit',
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
  ])('', ({ name, transactions, expectedHits }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedHits
    )
  })
})

{
  const TEST_TENANT_ID = getTestTenantId()
  testAggregationRebuild(
    TEST_TENANT_ID,
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'same-user-using-too-many-payment-identifiers',
      defaultParameters: {
        uniquePaymentIdentifiersCountThreshold: 1,
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
        originUserId: '1',
        timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'IBAN',
          BIC: '456',
          IBAN: '456',
        },
      }),
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T08:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'SWIFT',
          accountNumber: '789',
          bankName: '789',
          swiftCode: '789',
        },
      }),
      getTestTransaction({
        originUserId: '1',
        timestamp: dayjs('2022-01-01T09:00:00.000Z').valueOf(),
        originPaymentDetails: {
          method: 'CARD',
          cardFingerprint: '789',
        },
      }),
    ],
    {
      origin: [
        {
          paymentIdentifiers: ['BIC: 456, IBAN: 456', 'Card Fingerprint: 123'],
          hour: '2022010100',
        },
        {
          paymentIdentifiers: ['Account Number: 789, Swift Code: 789'],
          hour: '2022010108',
        },
        { paymentIdentifiers: ['Card Fingerprint: 789'], hour: '2022010109' },
      ],
      destination: undefined,
    }
  )
}
