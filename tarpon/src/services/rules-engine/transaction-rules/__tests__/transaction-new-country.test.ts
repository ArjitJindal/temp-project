import { TransactionNewCountryRuleParameters } from '../transaction-new-country'
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
          timestamp: dayjs().subtract(6, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(5, 'hour').valueOf(),
          originAmountDetails: {
            country: 'DE',
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
          destinationAmountDetails: {
            country: 'GB',
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originUserId: 'formatting-1-1',
          destinationUserId: 'formatting-1-2',
          timestamp: dayjs().subtract(4, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
          originAmountDetails: {
            country: 'GB',
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
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
        descriptionTemplate: getRuleByRuleId('R-3').descriptionTemplate,
      },
      [
        null,
        null,
        `User tried to send money from Germany more than 2 times. User has not sent any money from Germany prior.`,
        null,
        null,
        `User tried to receive money to India more than 2 times. User has not received any money to India prior.`,
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
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
          originAmountDetails: {
            country: 'DE',
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
          destinationAmountDetails: {
            country: 'GB',
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
        }),
        getTestTransaction({
          originUserId: '1-1',
          destinationUserId: '1-2',
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
          originAmountDetails: {
            country: 'DE',
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
          destinationAmountDetails: {
            country: 'GB',
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
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
          originAmountDetails: {
            country: 'GB',
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
          timestamp: dayjs().subtract(3, 'hour').valueOf(),
          originAmountDetails: {
            country: 'DE',
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
          destinationAmountDetails: {
            country: 'AF',
            transactionAmount: 68351.34,
            transactionCurrency: 'INR',
          },
        }),
        getTestTransaction({
          originUserId: '4-1',
          destinationUserId: '4-3',
          timestamp: dayjs().subtract(2, 'hour').valueOf(),
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
          timestamp: dayjs().subtract(1, 'hour').valueOf(),
          originAmountDetails: {
            country: 'DE',
            transactionAmount: 800,
            transactionCurrency: 'EUR',
          },
          destinationAmountDetails: {
            country: 'BE',
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

  describe('Optional parameters - Payment Channel', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transaction-new-country',
        defaultParameters: {
          initialTransactions: 2,
        } as TransactionNewCountryRuleParameters,
        defaultAction: 'FLAG',
        filters: {
          originPaymentFilters: {
            cardPaymentChannels: ['ATM'],
            paymentMethods: ['CARD'],
          },
        },
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'country transaction with same user and same payment channel- hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs().subtract(2, 'hour').valueOf(),
            originAmountDetails: {
              country: 'DE',
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            destinationAmountDetails: {
              country: 'GB',
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'country transaction with same user and different payment channel- hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs().subtract(3, 'hour').valueOf(),
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
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs().subtract(2, 'hour').valueOf(),
            originAmountDetails: {
              country: 'DE',
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            destinationAmountDetails: {
              country: 'GB',
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs().subtract(1, 'hour').valueOf(),
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
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
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
})
