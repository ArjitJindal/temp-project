import { PaymentDetailChangeRuleParameters } from '../payment-detail-change-base'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import dayjs from '@/utils/dayjs'

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

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('R-45: description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'bank-account-holder-name-change',
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
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST1',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST2',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          destinationPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST1',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          destinationPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST2',
          } as GenericBankAccountDetails,
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-45').descriptionTemplate,
      },
      [
        null,
        'Sender’s bank account holder name has changed.',
        null,
        'Receiver’s bank account holder name has changed.',
      ]
    )
  })

  describe('R-45: Rule behaviour', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'bank-account-holder-name-change',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
        defaultAction: 'FLAG',
      },
    ])
    describe.each<TransactionRuleTestCase>([
      {
        name: 'No hit when account name is empty',
        transactions: [
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              bankName: 'US Bank',
              name: '',
            } as GenericBankAccountDetails,
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'No hit since there were no other names used',
        transactions: [
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              bankName: 'US Bank',
              name: 'TEST1',
            } as GenericBankAccountDetails,
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'One hit since the account holder name changed',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              bankName: 'US Bank',
              name: 'TEST1',
            } as GenericBankAccountDetails,
          }),
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              bankName: 'US Bank',
              name: 'TEST2',
            } as GenericBankAccountDetails,
          }),
          getTestTransaction({
            originUserId: '1',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              bankName: 'US Bank',
              name: 'TEST2',
            } as GenericBankAccountDetails,
          }),
        ],
        expectedHits: [false, true, false],
      },
      {
        name: 'No hit when bank name is empty',
        transactions: [
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              bankName: 'US Bank',
              name: '',
            } as GenericBankAccountDetails,
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

describe('R-45 - Initial Transaction Threshold', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'bank-account-holder-name-change',
      defaultParameters: {
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        oldNamesThreshold: 1,
        initialTransactions: 4,
        allowedDistancePercentage: 0,
        ignoreEmptyName: true,
      },
      defaultAction: 'FLAG',
    },
  ])
  describe.each<TransactionRuleTestCase>([
    {
      name: 'No hit when transaction threshold is not met',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST1',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST2',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST3',
          } as GenericBankAccountDetails,
        }),
      ],
      expectedHits: [false, false, false],
    },
    {
      name: 'hit when transaction threshold is met',
      transactions: [
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST1',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST2',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST3',
          } as GenericBankAccountDetails,
        }),
        getTestTransaction({
          originPaymentDetails: {
            method: 'GENERIC_BANK_ACCOUNT',
            bankName: 'US Bank',
            name: 'TEST4',
          } as GenericBankAccountDetails,
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

describe('R-45 - Allowed Distance Percentage', () => {
  describe('Check on 25%', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'bank-account-holder-name-change',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          oldNamesThreshold: 1,
          initialTransactions: 1,
          allowedDistancePercentage: 25,
          ignoreEmptyName: true,
        },
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Name matches and is under allowed distance - not hit',
        transactions: [
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'TEST1',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'TEST1',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'TEST1',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'TEST2',
            },
          }),
        ],
        expectedHits: [false, false, false, false],
      },
      {
        name: 'Name matches and is not under allowed distance -  hit',
        transactions: [
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'TEST1',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Mr. TEST2',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'BPLM3',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'JKLMD',
            },
          }),
        ],
        expectedHits: [false, false, true, true],
      },
      {
        name: 'Name matches after removing prefixes and is not under allowed distance -  hit',
        transactions: [
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Fräulein. TEST1',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Mr. TEST2',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Srta. BPLM3',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Mlle JKLMD',
            },
          }),
          getTestTransaction({
            originPaymentDetails: {
              method: 'GENERIC_BANK_ACCOUNT',
              name: 'Ms. test1',
            },
          }),
        ],
        expectedHits: [false, false, false, false, false],
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
