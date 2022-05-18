import { TransactionNewCurrencyRuleParameters } from '../transaction-new-currency'
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
    ruleImplementationName: 'transaction-new-currency',
    defaultParameters: {
      initialTransactions: 2,
    } as TransactionNewCurrencyRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe.each<TransactionRuleTestCase>([
  {
    name: 'currency transaction with same user - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'BHD',
        },
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'CAD',
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
  },
  {
    name: 'Currency transaction with same sender, different receiver - hit',
    transactions: [
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-2',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 68351.34,
          transactionCurrency: 'CAD',
        },
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-3',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-4',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 68351.34,
          transactionCurrency: 'USD',
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
  },
  {
    name: 'Currency transaction with different sender, same receiver - hit',
    transactions: [
      getTestTransaction({
        originUserId: '3-2',
        destinationUserId: '3-1',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '3-3',
        destinationUserId: '3-1',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'CAD',
        },
        destinationAmountDetails: {
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '3-4',
        destinationUserId: '3-1',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'USD',
        },
        destinationAmountDetails: {
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
    ],
    expectedActions: ['ALLOW', 'ALLOW', 'FLAG'],
  },
  {
    name: 'Transaction with same currency - not hit',
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
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-3',
        originAmountDetails: {
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-4',
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
    expectedActions: ['ALLOW', 'ALLOW', 'ALLOW'],
  },
])('', ({ name, transactions, expectedActions }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedActions
  )
})
