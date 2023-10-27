import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  setUpRulesHooks,
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

dynamoDbSetupHook()

function getBankDetails(bankName: string): GenericBankAccountDetails {
  return {
    method: 'GENERIC_BANK_ACCOUNT',
    bankName,
  }
}

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
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        oldBanksThreshold: 1,
      } as BankNameChangeRuleParameters,
      defaultAction: 'FLAG',
    },
  ])
  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originPaymentDetails: getBankDetails('HSBC'),
      }),
      getTestTransaction({
        originPaymentDetails: getBankDetails('LLOYDS'),
      }),
      getTestTransaction({
        destinationPaymentDetails: getBankDetails('LLOYDS'),
      }),
      getTestTransaction({
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
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        oldBanksThreshold: 1,
      } as BankNameChangeRuleParameters,
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
          originPaymentDetails: getBankDetails('LLOYDS'),
        }),
        getTestTransaction({
          originPaymentDetails: getBankDetails('LLOYDS'),
        }),
      ],
      expectedHits: [true, false],
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
