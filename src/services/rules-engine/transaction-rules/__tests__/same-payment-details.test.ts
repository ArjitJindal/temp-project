import { v4 as uuidv4 } from 'uuid'
import { SamePaymentDetailsParameters } from '../same-payment-details'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'

const PAYMENT_METHOD_1: PaymentMethod = 'CARD'

const PAYMENT_DETAILS_1 = {
  method: PAYMENT_METHOD_1,
  cardFingerprint: uuidv4(),
  cardIssuedCountry: 'US',
  transactionReferenceField: 'DEPOSIT',
  _3dsDone: true,
} as PaymentDetails

dynamoDbSetupHook()

function getDefaultParams(): SamePaymentDetailsParameters {
  return {
    timeWindow: {
      granularity: 'day',
      units: 1,
      rollingBasis: true,
    },
    threshold: 2,
    checkSender: 'all',
    checkReceiver: 'all',
  }
}

const defaultParams = getDefaultParams()

describe('Core login', () => {
  const now = dayjs('2022-01-01T00:00:00.000Z')

  describe.each<TransactionRuleTestCase<Partial<SamePaymentDetailsParameters>>>(
    [
      {
        name: 'Single transaction never trigger the rule',
        transactions: [
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(1, 'week').valueOf(),
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'Simple case of reusing details',
        transactions: [
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
        ruleParams: {
          threshold: 3,
        },
      },
      {
        name: 'Ignore transactions out of time window',
        transactions: [
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(9999, 'hour').valueOf(),
          }),
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            transactionId: '333',
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
    ]
  )('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'same-payment-details',
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

describe('Different directions', () => {
  const now = dayjs('2022-01-01T00:00:00.000Z')

  describe.each<TransactionRuleTestCase<Partial<SamePaymentDetailsParameters>>>(
    [
      {
        name: 'Sender -> sending',
        transactions: [
          getTestTransaction({
            originPaymentDetails: undefined,
            destinationPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
        ruleParams: {
          checkSender: 'sending',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Sender -> all',
        transactions: [
          getTestTransaction({
            originPaymentDetails: undefined,
            destinationPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, true, true],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Receiver -> receiving',
        transactions: [
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            destinationPaymentDetails: undefined,
            timestamp: now.subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            destinationPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            destinationPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'receiving',
        },
      },
      {
        name: 'Receiver -> all',
        transactions: [
          getTestTransaction({
            originPaymentDetails: PAYMENT_DETAILS_1,
            destinationPaymentDetails: undefined,
            timestamp: now.subtract(2, 'hour').valueOf(),
          }),
          getTestTransaction({
            destinationPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.subtract(1, 'hour').valueOf(),
          }),
          getTestTransaction({
            destinationPaymentDetails: PAYMENT_DETAILS_1,
            timestamp: now.valueOf(),
          }),
        ],
        expectedHits: [false, true, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'all',
        },
      },
    ]
  )('', ({ name, transactions, expectedHits, ruleParams }) => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'same-payment-details',
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

describe('Description formatting', () => {
  describe('R-127 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const now = dayjs('2022-01-01T00:00:00.000Z')

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'same-payment-details',
        defaultParameters: {
          ...defaultParams,
        },
      },
    ])

    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originPaymentDetails: PAYMENT_DETAILS_1,
          timestamp: now.subtract(1, 'hour').valueOf(),
        }),
        getTestTransaction({
          originPaymentDetails: PAYMENT_DETAILS_1,
          timestamp: now.valueOf(),
        }),
      ],
      {
        descriptionTemplate: `Same payment details is used for {{ numberOfUses }} transactions within {{ format-time-window parameters.timeWindow }}, which is more or equal than threshold of {{ parameters.threshold }}`,
      },
      [
        null,
        'Same payment details is used for 2 transactions within 1 day, which is more or equal than threshold of 2',
      ]
    )
  })
})
