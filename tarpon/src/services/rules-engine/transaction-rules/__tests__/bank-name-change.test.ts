import {
  AggregationData,
  paymentDetailChangeReducer,
  PaymentDetailChangeRuleParameters,
} from '../payment-detail-change-base'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testAggregationRebuild,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import dayjs from '@/utils/dayjs'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getBankname } from '@/core/dynamodb/dynamodb-keys'

const DEFAULT_RULE_PARAMETERS: PaymentDetailChangeRuleParameters = {
  timeWindow: {
    units: 1,
    granularity: 'day',
  },
  oldNamesThreshold: 1,
  initialTransactions: 1,
  allowedDistancePercentage: 0,
  ignoreEmptyName: true,
}

const getBankDetail = (paymentDetails?: PaymentDetails): string | undefined => {
  return getBankname(paymentDetails)
}
dynamoDbSetupHook()

function getBankDetails(bankName: string): GenericBankAccountDetails {
  return {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName,
  }
}

ruleVariantsTest({ aggregation: true }, () => {
  describe('R-155: paymentDetailsChangeReducer', () => {
    test('', () => {
      const txns = [
        getTestTransaction({
          originPaymentDetails: getBankDetails('HSBC'),
        }),
        getTestTransaction({
          originPaymentDetails: getBankDetails('HSBC'),
        }),
        getTestTransaction({
          originPaymentDetails: getBankDetails('LLOYDS'),
        }),
      ]
      const agg = txns.reduce<AggregationData>(
        (agg, txn) =>
          paymentDetailChangeReducer('origin', agg, txn, getBankDetail),
        {
          senderPaymentDetailUsage: {},
          receiverPaymentDetailUsage: {},
          senderPreviousPaymentDetail: '',
          receiverPreviousPaymentDetail: '',
          transactionCount: 0,
        }
      )

      expect(agg).toEqual({
        receiverPaymentDetailUsage: {},
        senderPaymentDetailUsage: {
          HSBC: 2,
          LLOYDS: 1,
        },
        senderPreviousPaymentDetail: 'LLOYDS',
        receiverPreviousPaymentDetail: '',
        transactionCount: 3,
      })
    })
  })

  describe('R-155: description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'bank-name-change',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])
    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          originPaymentDetails: getBankDetails('HSBC'),
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
          originPaymentDetails: getBankDetails('LLOYDS'),
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          destinationPaymentDetails: getBankDetails('LLOYDS'),
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          destinationPaymentDetails: getBankDetails('HSBC'),
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-155').descriptionTemplate,
      },
      [
        null,
        'Sender’s bank name has changed.',
        null,
        'Receiver’s bank name has changed.',
      ]
    )
  })

  describe('R-155: Rule behaviour', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'bank-name-change',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])
    describe.each<TransactionRuleTestCase>([
      {
        name: 'No hit when bank name is empty',
        transactions: [
          getTestTransaction({
            originPaymentDetails: getBankDetails(''),
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'No hit since there were no other banks used',
        transactions: [
          getTestTransaction({
            originPaymentDetails: getBankDetails('HSBC'),
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'One hit since the bank changed',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: getBankDetails('HSBC'),
          }),
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            originPaymentDetails: getBankDetails('LLOYDS'),
          }),
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            originPaymentDetails: getBankDetails('LLOYDS'),
          }),
        ],
        expectedHits: [false, true, false],
      },
      {
        name: 'No hit when bank name is empty',
        transactions: [
          getTestTransaction({
            originPaymentDetails: getBankDetails(''),
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

testAggregationRebuild(
  getTestTenantId(),
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'bank-name-change',
    defaultParameters: {
      timeWindow: {
        units: 1,
        granularity: 'day',
        rollingBasis: true,
      },
      oldNamesThreshold: 1,
      initialTransactions: 1,
      allowedDistancePercentage: 0,
      ignoreEmptyName: true,
    },
  },
  [
    getTestTransaction({
      originPaymentDetails: getBankDetails('HSBC'),
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originPaymentDetails: getBankDetails('LLOYDS'),
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      destinationPaymentDetails: getBankDetails('LLOYDS'),
      timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      destinationPaymentDetails: getBankDetails('HSBC'),
      timestamp: dayjs('2022-01-01T01:30:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      {
        receiverPreviousPaymentDetail: '',
        senderPaymentDetailUsage: { lloyds: 1, hsbc: 1 },
        senderPreviousPaymentDetail: 'hsbc',
        receiverPaymentDetailUsage: {},
        transactionCount: 2,
        hour: '2022010100',
      },
      {
        receiverPreviousPaymentDetail: '',
        senderPaymentDetailUsage: {},
        senderPreviousPaymentDetail: '',
        receiverPaymentDetailUsage: {},
        transactionCount: 0,
        hour: '2022010101',
      },
    ],

    destination: [
      {
        receiverPreviousPaymentDetail: '',
        senderPaymentDetailUsage: {},
        senderPreviousPaymentDetail: '',
        receiverPaymentDetailUsage: {},
        transactionCount: 0,
        hour: '2022010100',
      },
      {
        receiverPreviousPaymentDetail: 'hsbc',
        senderPaymentDetailUsage: {},
        senderPreviousPaymentDetail: '',
        receiverPaymentDetailUsage: { lloyds: 1, hsbc: 1 },
        transactionCount: 2,
        hour: '2022010101',
      },
    ],
  }
)
