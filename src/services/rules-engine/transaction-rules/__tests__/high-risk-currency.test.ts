/* eslint-disable prettier/prettier */
import { HighRiskCurrencyRuleParameters } from '../high-risk-currency'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

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
      expectedActions: ['FLAG'],
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
      expectedActions: ['FLAG'],
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
      expectedActions: ['ALLOW'],
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
      expectedActions: ['FLAG'],
    },
  ])('', ({ name, transactions, expectedActions }) => {
    createTransactionRuleTestCase(
      name,
      TEST_TENANT_ID,
      transactions,
      expectedActions
    )
  })
})
