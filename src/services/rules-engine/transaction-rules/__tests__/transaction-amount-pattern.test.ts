import { TransactionMatchesPatternRuleParameters } from '../transaction-amount-pattern'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'transaction-amount-pattern',
    defaultParameters: {
      patterns: ['999', '123'],
    } as TransactionMatchesPatternRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'Suffix of transaction amount matches pattern - hit',
    transactions: [
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 10123,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 10,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 9999,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 10099,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 999,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 999123,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 999124,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [true, false, true, false, true, true, false],
  },
  {
    name: 'Prefix of transaction amount matches pattern - not hit',
    transactions: [
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 9990,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 999111,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'Decimal transaction amount matches pattern - hit',
    transactions: [
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 1000.999,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 10.1123,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 9999.99,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originAmountDetails: {
          transactionAmount: 9.99,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [false, false, true, false],
  },
])('', ({ name, transactions, expectedHits }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedHits
  )
})

describe('Optional parameters', () => {
  const TEST_TENANT_ID = getTestTenantId()
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-amount-pattern',
      defaultParameters: {
        patterns: ['999', '123'],
        checkDecimal: true,
      } as TransactionMatchesPatternRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Decimal transaction amount matches pattern - hit',
      transactions: [
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 1000.999,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 10.1123,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 9999.99,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 99.9,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [true, true, false, false],
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
