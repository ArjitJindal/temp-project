import { HighRiskCurrencyRuleParameters } from '../high-risk-currency'
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

dynamoDbSetupHook()

ruleVariantsTest({ v8: true, aggregation: false }, () => {
  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-risk-currency',
        defaultParameters: {
          highRiskCurrencies: [
            'AFN',
            'BTN',
            'CNY',
            'EGP',
            'IQD',
            'NGN',
            'INR',
            'USD',
            'EUR',
          ],
        } as HighRiskCurrencyRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe('R-6 description formatting', () => {
      testRuleDescriptionFormatting(
        'sender',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
            },
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-6').descriptionTemplate,
        },
        ['Sender’s currency (EUR) is a High Risk.']
      )

      testRuleDescriptionFormatting(
        'receiver',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '4-1',
            destinationUserId: '4-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'TWD',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'INR',
            },
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-6').descriptionTemplate,
        },
        ['Receiver’s currency (INR) is a High Risk.']
      )
    })

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Sender high/very high risk and receiver low/medium risk currency',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'Sender low/medium risk and receiver high/very high risk currency',
        transactions: [
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'THB',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'INR',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'Both sender and receiver, low/medium risk currency',
        transactions: [
          getTestTransaction({
            originUserId: '3-1',
            destinationUserId: '3-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'RWF',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
            },
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'Both sender and receiver, high/very high risk currency',
        transactions: [
          getTestTransaction({
            originUserId: '4-1',
            destinationUserId: '4-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'INR',
            },
          }),
        ],
        expectedHits: [true],
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
