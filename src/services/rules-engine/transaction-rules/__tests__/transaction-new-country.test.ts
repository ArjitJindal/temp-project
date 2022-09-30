import { TransactionNewCountryRuleParameters } from '../transaction-new-country'
import { getTransactionRuleByRuleId } from '../library'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'transaction-new-country',
    defaultParameters: {
      initialTransactions: 2,
    } as TransactionNewCountryRuleParameters,
    defaultAction: 'FLAG',
  },
])

describe('R-3 description formatting', () => {
  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: 'formatting-1-1',
        destinationUserId: 'formatting-1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: 'formatting-1-1',
        destinationUserId: 'formatting-1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'UK',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: 'formatting-1-1',
        destinationUserId: 'formatting-1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'AF',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: 'formatting-1-1-2',
        destinationUserId: 'formatting-1-2-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: 'formatting-1-1-2',
        destinationUserId: 'formatting-1-2-2',
        originAmountDetails: {
          country: 'UK',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: 'formatting-1-1-2',
        destinationUserId: 'formatting-1-2-2',
        originAmountDetails: {
          country: 'AF',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-3').descriptionTemplate,
    },
    [
      null,
      null,
      `User tried to send money from Germany more than 2 times. User has not sent any money from Germany prior`,
      null,
      null,
      `User tried to receive money to India more than 2 times. User has not received any money to India prior`,
    ]
  )
})

describe.each<TransactionRuleTestCase>([
  {
    name: 'country transaction with same user - hit',
    transactions: [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'UK',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'AF',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [false, false, true],
  },
  {
    name: 'Country transaction with same sender, different receiver - hit',
    transactions: [
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-3',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-4',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'UK',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
    ],
    expectedHits: [false, false, true],
  },
  {
    name: 'Country transaction with different sender, same receiver - hit',
    transactions: [
      getTestTransaction({
        originUserId: '3-2',
        destinationUserId: '3-1',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '3-3',
        destinationUserId: '3-1',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '3-4',
        destinationUserId: '3-1',
        originAmountDetails: {
          country: 'UK',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
    ],
    expectedHits: [false, false, true],
  },
  {
    name: 'Transaction with different country - not hit',
    transactions: [
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'AFG',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-3',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
      getTestTransaction({
        originUserId: '4-1',
        destinationUserId: '4-4',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'BEL',
          transactionAmount: 68351.34,
          transactionCurrency: 'INR',
        },
      }),
    ],
    expectedHits: [false, false, true],
  },
])('', ({ name, transactions, expectedHits }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedHits
  )
})
