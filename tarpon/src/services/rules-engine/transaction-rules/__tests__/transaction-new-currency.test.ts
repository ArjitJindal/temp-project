import { TransactionNewCurrencyRuleParameters } from '../transaction-new-currency'
import { getRuleByRuleId } from '../library'
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
import dayjs from '@/utils/dayjs'

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: false, v8: true }, () => {
  const TEST_TENANT_ID = getTestTenantId()
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

  describe('R-4 description formatting', () => {
    testRuleDescriptionFormatting(
      'sender',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: 'description-1',
          destinationUserId: 'description-2',
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          originUserId: 'description-1',
          destinationUserId: 'description-2',
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
          originUserId: 'description-1',
          destinationUserId: 'description-2',
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
      {
        descriptionTemplate: getRuleByRuleId('R-4').descriptionTemplate,
      },
      [
        null,
        null,
        'User tried to send money in EUR more than 2 times. User has not sent any money in EUR prior.',
      ]
    )

    testRuleDescriptionFormatting(
      'receiver',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '1-1-1',
          destinationUserId: '1-2-1',
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
          originAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'INR',
          },
          destinationAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originUserId: '1-1-1',
          destinationUserId: '1-2-1',
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
          originAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'BHD',
          },
          destinationAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originUserId: '1-1-1',
          destinationUserId: '1-2-1',
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
          originAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'CAD',
          },
          destinationAmountDetails: {
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-4').descriptionTemplate,
      },
      [
        null,
        null,
        'User tried to receive money in EUR more than 2 times. User has not received any money in EUR prior.',
      ]
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'currency transaction with same user - hit',
      transactions: [
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs().subtract(4, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
      expectedHits: [false, false, true],
    },
    {
      name: 'Currency transaction with same sender, different receiver - hit',
      transactions: [
        getTestTransaction({
          originUserId: '2-1',
          destinationUserId: '2-2',
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
      expectedHits: [false, false, true],
    },
    {
      name: 'Currency transaction with different sender, same receiver - hit',
      transactions: [
        getTestTransaction({
          originUserId: '3-2',
          destinationUserId: '3-1',
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
      expectedHits: [false, false, true],
    },
    {
      name: 'Transaction with same currency - not hit',
      transactions: [
        getTestTransaction({
          originUserId: '4-1',
          destinationUserId: '4-2',
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
      expectedHits: [false, false, false],
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
