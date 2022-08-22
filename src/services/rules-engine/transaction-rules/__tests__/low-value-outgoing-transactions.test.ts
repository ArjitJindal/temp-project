import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

setUpRulesHooks(TEST_TENANT_ID, [
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'low-value-outgoing-transactions',
    defaultParameters: {
      lowTransactionValues: {
        EUR: {
          min: 2,
          max: 10,
        },
      },
      lowTransactionCount: 2,
    },
    defaultAction: 'FLAG',
  },
])

describe('R-8 description formatting', () => {
  const descriptionTemplate = `{{ if-sender 'Sender' 'Receiver' }} sent {{ transactionCountDelta }} transactions just under the flagging limit`
  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: 'description-1',
        destinationUserId: 'description-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 6,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 6,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: 'description-1',
        destinationUserId: 'description-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 7,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 7,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    {
      descriptionTemplate,
    },
    [null, 'Sender sent 1 transactions just under the flagging limit']
  )
})

describe.each<TransactionRuleTestCase>([
  {
    name: 'hit',
    transactions: [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 6,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 6,
          transactionCurrency: 'EUR',
        },
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 7,
          transactionCurrency: 'EUR',
        },
        destinationAmountDetails: {
          country: 'IN',
          transactionAmount: 7,
          transactionCurrency: 'EUR',
        },
      }),
    ],
    expectedHits: [false, true],
  },
])('', ({ name, transactions, expectedHits }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedHits
  )
})
