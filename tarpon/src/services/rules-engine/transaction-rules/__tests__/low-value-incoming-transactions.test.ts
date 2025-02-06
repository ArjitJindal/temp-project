import { getRuleByRuleId } from '../library'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testAggregationRebuild,
  testRuleDescriptionFormatting,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import dayjs from '@/utils/dayjs'

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'low-value-incoming-transactions',
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

  describe('R-7 description formatting', () => {
    const timestamp = dayjs('2024-01-01').valueOf()
    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: 'description-1',
          destinationUserId: 'description-2',
          timestamp,
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
          timestamp: timestamp + 10,
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
        descriptionTemplate: getRuleByRuleId('R-7').descriptionTemplate,
      },
      [null, 'Receiver sent 1 transactions just under the flagging limit.']
    )
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const timestamp = dayjs('2022-01-01').valueOf()
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

    describe.each<TransactionRuleTestCase>([
      {
        name: 'hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp,
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
            timestamp: timestamp + 10,
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
  })

  describe('extended core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const timestamp = dayjs('2022-01-01').valueOf()
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

    describe.each<TransactionRuleTestCase>([
      {
        name: 'extended hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp,
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
            timestamp: timestamp + 10,
            originAmountDetails: {
              country: 'DE',
              transactionAmount: 17,
              transactionCurrency: 'EUR',
            },
            destinationAmountDetails: {
              country: 'IN',
              transactionAmount: 17,
              transactionCurrency: 'EUR',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: timestamp + 20,
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
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: timestamp + 30,
            originAmountDetails: {
              country: 'DE',
              transactionAmount: 5,
              transactionCurrency: 'EUR',
            },
            destinationAmountDetails: {
              country: 'IN',
              transactionAmount: 5,
              transactionCurrency: 'EUR',
            },
          }),
        ],
        expectedHits: [false, false, false, true],
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

ruleVariantsTest({ aggregation: true, v8: false }, () => {
  describe('Optional parameters - Payment Channel', () => {
    const TEST_TENANT_ID = getTestTenantId()
    const timestamp = dayjs('2024-01-01').valueOf()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'low-value-incoming-transactions',
        defaultParameters: {
          lowTransactionValues: {
            EUR: {
              min: 2,
              max: 10,
            },
          },
          lowTransactionCount: 2,
        },
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
        name: 'With same paymentchannel - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp,
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
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: timestamp + 10,
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
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: timestamp + 20,
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
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
          }),
        ],
        expectedHits: [false, true, true],
      },
      {
        name: 'With different paymentchannel - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp,
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
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
            },
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: timestamp + 10,
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
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
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
})

testAggregationRebuild(
  getTestTenantId(),
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'low-value-incoming-transactions',
    defaultParameters: {
      lowTransactionValues: {
        EUR: {
          min: 2,
          max: 10,
        },
      },
      lowTransactionCount: 3,
    },
  },
  [
    getTestTransaction({
      timestamp: dayjs('2024-01-01').valueOf(),
      destinationUserId: '1',
      destinationAmountDetails: {
        country: 'DE',
        transactionAmount: 3,
        transactionCurrency: 'EUR',
      },
    }),
    getTestTransaction({
      timestamp: dayjs('2024-01-02').valueOf() + 10,
      destinationUserId: '1',
      destinationAmountDetails: {
        country: 'DE',
        transactionAmount: 100,
        transactionCurrency: 'EUR',
      },
    }),
    getTestTransaction({
      timestamp: dayjs('2024-01-03').valueOf() + 20,
      destinationUserId: '1',
      destinationAmountDetails: {
        country: 'DE',
        transactionAmount: 5,
        transactionCurrency: 'EUR',
      },
    }),
  ],
  {
    destination: [
      {
        lastNTransactionAmounts: [
          {
            country: 'DE',
            transactionAmount: 5,
            transactionCurrency: 'EUR',
          },
          {
            country: 'DE',
            transactionAmount: 100,
            transactionCurrency: 'EUR',
          },
        ],
        hour: '1970',
      },
    ],
    origin: undefined,
  }
)
