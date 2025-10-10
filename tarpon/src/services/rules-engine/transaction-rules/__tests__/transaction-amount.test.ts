import { TransactionAmountRuleParameters } from '../transaction-amount'
import { getRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
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
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'

dynamoDbSetupHook()
ruleVariantsTest({ aggregation: false, v8: true }, () => {
  describe('R-2 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transaction-amount',
        defaultParameters: {
          transactionAmountThreshold: { USD: 1000, EUR: 1000 },
        } as TransactionAmountRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: '1',
        userDetails: {
          name: {
            firstName: '1',
          },
        },
      }),
    ])

    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '1',
          originAmountDetails: {
            transactionAmount: 10000,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-2').descriptionTemplate,
      },
      ['Transaction amount is 1000.00 EUR or more.']
    )
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transaction-amount',
        defaultParameters: {
          transactionAmountThreshold: { EUR: 1000 },
        } as TransactionAmountRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    const user1DateOfBirth = dayjs().subtract(20, 'years')
    const user2DateOfBirth = dayjs().subtract(40, 'years')

    setUpUsersHooks(TEST_TENANT_ID, [
      getTestUser({
        userId: '1',
        userDetails: {
          name: {
            firstName: '1',
          },
          dateOfBirth: user1DateOfBirth.format('YYYY-MM-DD'),
        },
      }),
      getTestUser({
        userId: '2',
        userDetails: {
          name: {
            firstName: '2',
          },
          dateOfBirth: user2DateOfBirth.format('YYYY-MM-DD'),
        },
      }),
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'too big transaction amount - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            originAmountDetails: {
              transactionAmount: 10000,
              transactionCurrency: 'EUR',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'too big transaction amount (currency not in the rule params) - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            originAmountDetails: {
              transactionAmount: 10000,
              transactionCurrency: 'USD',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'normal transaction amount - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'Missing sender user ID - hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            originAmountDetails: {
              transactionAmount: 10000,
              transactionCurrency: 'EUR',
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

  describe('Optional parameters - Payment Channel', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transaction-amount',
        defaultParameters: {
          transactionAmountThreshold: { EUR: 1000 },
        } as TransactionAmountRuleParameters,
        filters: {
          originPaymentFilters: {
            cardPaymentChannels: ['ATM'],
            paymentMethods: ['CARD'],
          },
        },
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Transaction amount above threshold with same paymentchannel - hit',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            originAmountDetails: {
              transactionAmount: 10000,
              transactionCurrency: 'EUR',
            },
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'Transaction amount above threshold with different paymentchannel - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            originAmountDetails: {
              transactionAmount: 10000,
              transactionCurrency: 'EUR',
            },
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'GOOGLE_PAY',
            },
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'Transaction amount below threshold with same paymentchannel - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'Transaction amount below threshold with different paymentchannel - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            originAmountDetails: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'GOOGLE_PAY',
            },
          }),
        ],
        expectedHits: [false],
      },
      {
        name: 'Transaction amount above threshold with different paymentchannel and different payment method - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '2',
            originAmountDetails: {
              transactionAmount: 10000,
              transactionCurrency: 'EUR',
            },
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
            },
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
