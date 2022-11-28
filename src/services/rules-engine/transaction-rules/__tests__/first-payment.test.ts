import { getTransactionRuleByRuleId } from '../library'
import { FirstPaymentRuleParameter } from '../first-payment'
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
    ruleImplementationName: 'first-payment',
    defaultAction: 'FLAG',
  },
])

describe('R-1 description formatting', () => {
  testRuleDescriptionFormatting(
    'first',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originUserId: '1',
      }),
    ],
    {
      descriptionTemplate:
        getTransactionRuleByRuleId('R-1').descriptionTemplate,
    },
    ['Sender’s first transaction.']
  )
})

describe.each<TransactionRuleTestCase>([
  {
    name: 'First transaction of a customerr- hit',
    transactions: [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
      }),
    ],
    expectedHits: [true],
  },
  {
    name: 'Second transaction of a customer - hit',
    transactions: [
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-1',
      }),
      getTestTransaction({
        originUserId: '2-1',
        destinationUserId: '2-3',
      }),
    ],
    expectedHits: [true, false],
  },
  {
    name: 'Transaction of different customers - hit',
    transactions: [
      getTestTransaction({
        originUserId: '3-1',
        destinationUserId: '3-2',
      }),
      getTestTransaction({
        originUserId: '3-3',
        destinationUserId: '3-4',
      }),
      getTestTransaction({
        originUserId: '3-1',
        destinationUserId: '3-3',
      }),
    ],
    expectedHits: [true, true, false],
  },
])('', ({ name, transactions, expectedHits }) => {
  createTransactionRuleTestCase(
    name,
    TEST_TENANT_ID,
    transactions,
    expectedHits
  )
})

describe('Transaction Amount Threshold', () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'first-payment',
      defaultParameters: {
        transactionAmountThreshold: { EUR: 1000 },
      } as FirstPaymentRuleParameter,
      defaultAction: 'FLAG',
    },
  ])

  describe.each<TransactionRuleTestCase>([
    {
      name: 'First payment with transaction amount above threshold - hit',
      transactions: [
        getTestTransaction({
          originUserId: '4-1',
          destinationUserId: '4-2',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [true],
    },
    {
      name: 'First payment with transaction amount below threshold - hit',
      transactions: [
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-2',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originUserId: '5-1',
          destinationUserId: '5-2',
          originAmountDetails: {
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      expectedHits: [false, false],
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
