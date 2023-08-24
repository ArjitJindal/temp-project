import { TransactionVolumeExceedsTwoPeriodsRuleParameters } from '../total-transactions-volume-exceeds'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  TransactionRuleTestCase,
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_AMOUNT_500: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 1500,
}

dynamoDbSetupHook()
withFeatureHook(['RULES_ENGINE_V2'])

function getDefaultParams(): TransactionVolumeExceedsTwoPeriodsRuleParameters {
  return {
    period1: {
      granularity: 'day',
      units: 1,
      rollingBasis: true,
    },
    period2: {
      granularity: 'day',
      units: 2,
      rollingBasis: true,
    },
    multiplierThreshold: {
      currency: 'EUR',
      value: 200,
    },
    checkSender: 'all',
    checkReceiver: 'all',
    excludePeriod1: true,
  }
}

ruleVariantsTest(true, () => {
  const defaultParams = getDefaultParams()

  describe('Core logic', () => {
    const now = dayjs('2021-01-01T00:00:00.000Z')

    describe.each<
      TransactionRuleTestCase<
        Partial<TransactionVolumeExceedsTwoPeriodsRuleParameters>
      >
    >([
      {
        name: 'No transactions within periods',
        transactions: [],
        expectedHits: [],
        ruleParams: getDefaultParams(),
      },
      {
        name: 'Multiple transactions which keep the total volume below threshold',
        transactions: [
          getTestTransaction({
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Multiple transactions which keep the total volume high enough',
        transactions: [
          getTestTransaction({
            transactionId: 'transaction1',
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(2, 'day').subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: 'transaction2',
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: undefined,
            timestamp: now.subtract(1, 'day').subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: 'transaction3',
            originUserId: 'sender1',
            destinationUserId: 'receiver1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_500,
            destinationAmountDetails: undefined,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
    ])('Rule variants', ({ name, ruleParams, transactions, expectedHits }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'total-transactions-volume-exceeds',
          defaultParameters: {
            ...defaultParams,
            ...ruleParams,
          },
        },
      ])

      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits
      )
    })
  })
})
