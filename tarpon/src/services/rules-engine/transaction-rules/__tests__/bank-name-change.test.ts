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
import {
  AggregationData,
  bankNameChangeReducer,
  BankNameChangeRuleParameters,
} from '@/services/rules-engine/transaction-rules/bank-name-change'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import dayjs from '@/utils/dayjs'

const DEFAULT_RULE_PARAMETERS: BankNameChangeRuleParameters = {
  timeWindow: {
    units: 1,
    granularity: 'day',
  },
  oldBanksThreshold: 1,
}

dynamoDbSetupHook()

function getBankDetails(bankName: string): GenericBankAccountDetails {
  return {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName,
  }
}

ruleVariantsTest(true, () => {
  describe('R-155: bankNameChangeReducer', () => {
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
        (agg, txn) => bankNameChangeReducer('origin', agg, txn),
        {
          senderBanknameUsage: {},
          receiverBanknameUsage: {},
          senderPreviousBankName: '',
          receiverPreviousBankName: '',
        }
      )

      expect(agg).toEqual({
        receiverBanknameUsage: {},
        senderBanknameUsage: {
          HSBC: 2,
          LLOYDS: 1,
        },
        senderPreviousBankName: 'LLOYDS',
        receiverPreviousBankName: '',
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
    defaultParameters: DEFAULT_RULE_PARAMETERS,
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
        receiverPreviousBankName: '',
        senderBanknameUsage: { LLOYDS: 1, HSBC: 1 },
        senderPreviousBankName: 'HSBC',
        receiverBanknameUsage: {},
        hour: '2022010100',
      },
      {
        receiverPreviousBankName: '',
        senderBanknameUsage: {},
        senderPreviousBankName: '',
        receiverBanknameUsage: {},
        hour: '2022010101',
      },
    ],

    destination: [
      {
        receiverPreviousBankName: '',
        senderBanknameUsage: {},
        senderPreviousBankName: '',
        receiverBanknameUsage: {},
        hour: '2022010100',
      },
      {
        receiverPreviousBankName: 'HSBC',
        senderBanknameUsage: {},
        senderPreviousBankName: '',
        receiverBanknameUsage: { LLOYDS: 1, HSBC: 1 },
        hour: '2022010101',
      },
    ],
  }
)
