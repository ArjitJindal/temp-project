import { TransactionsVelocityRuleParameters } from '../transactions-velocity'
import { getRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
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
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_METHOD_IBAN_1 = {
  method: 'IBAN',
  BIC: 'AXISINBB250',
  IBAN: 'ES9121000418450200051332',
} as IBANDetails

const TEST_TRANSACTION_METHOD_IBAN_2 = {
  method: 'IBAN',
  BIC: 'BKDNINBBDDR',
  IBAN: 'PL61109010140000071219812',
} as IBANDetails

const DEFAULT_RULE_PARAMETERS: TransactionsVelocityRuleParameters = {
  transactionsLimit: 2,
  timeWindow: {
    units: 5,
    granularity: 'hour',
  },
  checkSender: 'all',
  checkReceiver: 'all',
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('Description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
      },
    ])

    describe('R-30 description formatting', () => {
      testRuleDescriptionFormatting(
        'first',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-30').descriptionTemplate,
        },
        [
          null,
          null,
          'Sender made 1 more transaction(s) above the limit of 2 in 5 hours.',
          'Sender made 2 more transaction(s) above the limit of 2 in 5 hours.',
        ]
      )
    })
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Too frequent sending transactions - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            timestamp: dayjs('2022-01-01T00:00:00.001Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            timestamp: dayjs('2022-01-01T00:00:00.002Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Too frequent receiving transactions - hit',
        transactions: [
          getTestTransaction({
            originUserId: '2-2',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-3',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-4',
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Too frequent sending and receiving transactions - hit',
        transactions: [
          getTestTransaction({
            originUserId: '3-1',
            destinationUserId: '3-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '3-3',
            destinationUserId: '3-1',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '3-1',
            destinationUserId: '3-4',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Frequent transactions by different users - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '4-1',
            destinationUserId: '4-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '4-3',
            destinationUserId: '4-4',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '4-5',
            destinationUserId: '4-6',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Frequent transactions without user IDs - not hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            destinationUserId: undefined,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            destinationUserId: undefined,
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            destinationUserId: undefined,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Normal transactions - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '5-1',
            destinationUserId: '5-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '5-1',
            destinationUserId: '5-3',
            timestamp: dayjs('2022-01-01T10:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '5-1',
            destinationUserId: '5-4',
            timestamp: dayjs('2022-01-01T20:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Too frequent transactions - hit twice',
        transactions: [
          getTestTransaction({
            originUserId: '6-1',
            destinationUserId: '6-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '6-1',
            destinationUserId: '6-3',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '6-1',
            destinationUserId: '6-4',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '6-1',
            destinationUserId: '6-2',
            timestamp: dayjs('2022-01-02T00:10:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '6-1',
            destinationUserId: '6-3',
            timestamp: dayjs('2022-01-02T00:10:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '6-1',
            destinationUserId: '6-4',
            timestamp: dayjs('2022-01-02T00:10:02.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, false, false, true],
      },
      {
        name: 'Out-of-order transactions - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '7-1',
            destinationUserId: '7-4',
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '7-1',
            destinationUserId: '7-3',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '7-1',
            destinationUserId: '7-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Duplicated transactions - not hit',
        transactions: [
          getTestTransaction({
            transactionId: '8-1',
            originUserId: '8-1',
            destinationUserId: '8-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '8-1',
            originUserId: '8-1',
            destinationUserId: '8-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '8-1',
            originUserId: '8-1',
            destinationUserId: '8-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Transactions with same timestamp',
        transactions: [
          getTestTransaction({
            transactionId: '9-1',
            originUserId: '9-1',
            destinationUserId: '9-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '9-2',
            originUserId: '9-1',
            destinationUserId: '9-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '9-3',
            originUserId: '9-1',
            destinationUserId: '9-2',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '9-4',
            originUserId: '9-1',
            destinationUserId: '9-2',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
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

  describe('checksender/checkreceiver', () => {
    const TEST_HIT_TRANSACTIONS = [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-4',
        destinationUserId: '1-3',
        timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-5',
        destinationUserId: '1-3',
        timestamp: dayjs('2022-01-01T04:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-6',
        destinationUserId: '1-3',
        timestamp: dayjs('2022-01-01T05:00:00.000Z').valueOf(),
      }),
    ]

    describe.each<
      TransactionRuleTestCase<Partial<TransactionsVelocityRuleParameters>>
    >([
      {
        name: 'Sender: all, Receiver: all',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, true],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'all',
        },
      },
      {
        name: 'Sender: sending, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, false],
        ruleParams: {
          checkSender: 'sending',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Sender: all, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, false],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'none',
        },
      },
      {
        name: 'Sender: none, Receiver: receiving',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, false, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'receiving',
        },
      },
      {
        name: 'Sender: none, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, false, false, false, false],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'none',
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-velocity',
          defaultParameters: {
            transactionsLimit: 2,
            timeWindow: {
              units: 5,
              granularity: 'hour',
            },
            ...ruleParams,
          } as TransactionsVelocityRuleParameters,
        },
      ])
      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits
      )
    })
  })

  describe('Rolling basis parameter', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: {
          transactionsLimit: 1,
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: false,
          },
          checkSender: 'all',
          checkReceiver: 'all',
        } as TransactionsVelocityRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Transaction out of limit - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Transaction in limit - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-2',
            timestamp: dayjs('2022-01-01T11:59:59.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-3',
            timestamp: dayjs('2022-01-02T00:00:01.000Z').valueOf(),
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

  describe('Anonymous sender/receiver', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: {
          transactionsLimit: 1,
          timeWindow: {
            units: 5,
            granularity: 'hour',
          },
          checkSender: 'sending',
          checkReceiver: 'receiving',
          originMatchPaymentMethodDetails: true,
          destinationMatchPaymentMethodDetails: true,
        } as TransactionsVelocityRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Anonymous sender - hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-1',
            },
            destinationUserId: '2-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-1',
            },
            destinationUserId: '2-2',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Anonymous receiver - hit',
        transactions: [
          getTestTransaction({
            originUserId: '4-1',
            destinationUserId: undefined,
            destinationPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-2',
            },
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '4-2',
            destinationUserId: undefined,
            destinationPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-2',
            },
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Anonymous sender (proper identifier) - hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: { method: 'CARD', cardFingerprint: '123' },
            destinationUserId: '5-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: { method: 'CARD', cardFingerprint: '123' },
            destinationUserId: '5-2',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Anonymous sender (missing identifier) - not hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: { method: 'CARD' },
            destinationUserId: '6-1',
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: { method: 'CARD' },
            destinationUserId: '6-2',
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
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

  describe('Optional parameters - Payment Channel', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
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
        name: 'Too frequent sending transactions with same payment channel- hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            originPaymentDetails: {
              method: 'CARD',
              paymentChannel: 'ATM',
            },
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Too frequent sending transactions with different payment channel - not hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
            },
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
            },
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            originPaymentDetails: {
              method: 'WALLET',
              paymentChannel: 'Random',
              walletType: 'Checking',
            },
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
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

  describe('Match payment details method', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-velocity',
        defaultParameters: {
          transactionsLimit: 2,
          timeWindow: {
            units: 5,
            granularity: 'hour',
          },
          paymentMethod: 'CARD',
          checkSender: 'all',
          checkReceiver: 'all',
          originMatchPaymentMethodDetails: true,
          destinationMatchPaymentMethodDetails: true,
        } as TransactionsVelocityRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Too frequent sending transactions with same payment method - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_1,
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_2,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_2,
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_2,
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_2,
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, true],
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
    ruleImplementationName: 'transactions-velocity',
    defaultParameters: DEFAULT_RULE_PARAMETERS,
  },
  [
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1-1',
      destinationUserId: '1-2',
      timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      { sendingCount: 2, hour: '2022010100' },
      { sendingCount: 1, hour: '2022010102' },
    ],
    destination: [
      { receivingCount: 2, hour: '2022010100' },
      { receivingCount: 1, hour: '2022010102' },
    ],
  }
)
