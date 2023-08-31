import { SameUserUsingTooManyCardsParameters } from '../same-user-using-too-many-cards'
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
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()
withFeatureHook(['RULES_ENGINE_V2'])

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'same-user-using-too-many-cards',
    defaultParameters: {
      uniqueCardsCountThreshold: 1,
      timeWindowInDays: 1,
    } as SameUserUsingTooManyCardsParameters,
    defaultAction: 'FLAG',
  },
])

ruleVariantsTest(true, () => {
  describe('R-54 description formatting', () => {
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
            method: 'CARD',
            cardFingerprint: '456',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-54').descriptionTemplate,
      },
      [null, 'Sender used 2 unique cards above the limit of 1.']
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Same users using different cards - hit',
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
            method: 'CARD',
            cardFingerprint: '456',
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
