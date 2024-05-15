import { TransactionMatchesPatternRuleParameters } from '../transaction-amount-pattern'
import { getRuleByRuleId } from '../library'
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

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

ruleVariantsTest({ v8: true, aggregation: false }, () => {
  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-amount-pattern',
      defaultParameters: {
        patterns: ['999', '123'],
      } as TransactionMatchesPatternRuleParameters,
      defaultAction: 'FLAG',
      defaultBaseCurrency: 'USD',
    },
  ])

  describe('R-117 description formatting', () => {
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 10123,
            transactionCurrency: 'USD',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-117').descriptionTemplate,
      },
      [
        'Transaction amount of 10123.00 USD matches a blacklisted pattern ending with 123.',
      ]
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'Suffix of transaction amount matches pattern - hit',
      transactions: [
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 10123,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 10,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 9999,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 10099,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 999,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 999123,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 999124,
            transactionCurrency: 'USD',
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
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 999111,
            transactionCurrency: 'USD',
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
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 10.1123,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 9999.99,
            transactionCurrency: 'USD',
          },
        }),
        getTestTransaction({
          originAmountDetails: {
            transactionAmount: 9.99,
            transactionCurrency: 'USD',
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
        defaultBaseCurrency: 'USD',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Decimal transaction amount matches pattern - hit',
        transactions: [
          getTestTransaction({
            originAmountDetails: {
              transactionAmount: 1000.999,
              transactionCurrency: 'USD',
            },
          }),
          getTestTransaction({
            originAmountDetails: {
              transactionAmount: 10.1123,
              transactionCurrency: 'USD',
            },
          }),
          getTestTransaction({
            originAmountDetails: {
              transactionAmount: 9999.99,
              transactionCurrency: 'USD',
            },
          }),
          getTestTransaction({
            originAmountDetails: {
              transactionAmount: 99.9,
              transactionCurrency: 'USD',
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
})
