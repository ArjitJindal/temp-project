import { TransactionsVolumeRuleParameters } from '../transactions-volume'
import { getTransactionRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
  ruleVariantsTest,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_METHOD_IBAN_1 = {
  method: 'IBAN',
  BIC: 'AXISINBB250',
  IBAN: 'ES9121000418450200051332',
}

const TEST_TRANSACTION_METHOD_IBAN_2 = {
  method: 'IBAN',
  BIC: 'BKDNINBBDDR',
  IBAN: 'PL61109010140000071219812',
}

dynamoDbSetupHook()

ruleVariantsTest(true, () => {
  describe('Core logic', () => {
    const TEST_HIT_TRANSACTIONS = [
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-2',
        destinationUserId: '1-1',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2022-01-01T00:10:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-2',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2022-01-01T00:20:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-1',
        destinationUserId: '1-3',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-2',
        destinationUserId: '1-1',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2022-01-01T00:40:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1-4',
        destinationUserId: '1-2',
        originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
        timestamp: dayjs('2022-01-01T00:50:00.000Z').valueOf(),
      }),
    ]

    describe('R-69 description formatting', () => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-volume',
          defaultParameters: {
            timeWindow: {
              units: 3600,
              granularity: 'second',
            },
            ...{
              checkSender: 'all',
              checkReceiver: 'all',
              transactionVolumeThreshold: {
                EUR: 201,
              },
            },
          } as TransactionsVolumeRuleParameters,
        },
      ])

      testRuleDescriptionFormatting(
        'first',
        TEST_TENANT_ID,
        TEST_HIT_TRANSACTIONS,
        {
          descriptionTemplate:
            getTransactionRuleByRuleId('R-69').descriptionTemplate,
        },
        [
          null,
          null,
          'Sender is spending 99.00 EUR above their expected amount of 201.00 EUR. Receiver is receiving 99.00 EUR above their expected amount of 201.00 EUR.',
          'Sender is spending 199.00 EUR above their expected amount of 201.00 EUR.',
          'Sender is spending 199.00 EUR above their expected amount of 201.00 EUR. Receiver is receiving 299.00 EUR above their expected amount of 201.00 EUR.',
          'Receiver is receiving 299.00 EUR above their expected amount of 201.00 EUR.',
        ]
      )
    })

    describe.each<
      TransactionRuleTestCase<Partial<TransactionsVolumeRuleParameters>>
    >([
      {
        name: 'Sender: all, Receiver: all',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, true, true, true],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'all',
          transactionVolumeThreshold: {
            EUR: 201,
          },
        },
      },
      {
        name: 'Sender: sending, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, false, true, false, false],
        ruleParams: {
          checkSender: 'sending',
          checkReceiver: 'none',
          transactionVolumeThreshold: {
            EUR: 300,
          },
        },
      },
      {
        name: 'Sender: all, Receiver: none',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, true, true, false],
        ruleParams: {
          checkSender: 'all',
          checkReceiver: 'none',
          transactionVolumeThreshold: {
            EUR: 300,
          },
        },
      },
      {
        name: 'Sender: none, Receiver: receiving',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, false, false, false, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'receiving',
          transactionVolumeThreshold: {
            EUR: 300,
          },
        },
      },
      {
        name: 'Sender: none, Receiver: all',
        transactions: TEST_HIT_TRANSACTIONS,
        expectedHits: [false, false, true, false, true, true],
        ruleParams: {
          checkSender: 'none',
          checkReceiver: 'all',
          transactionVolumeThreshold: {
            EUR: 300,
          },
        },
      },
    ])('', ({ name, transactions, expectedHits, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transactions-volume',
          defaultParameters: {
            timeWindow: {
              units: 3600,
              granularity: 'second',
            },
            ...ruleParams,
          } as TransactionsVolumeRuleParameters,
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
        ruleImplementationName: 'transactions-volume',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: false,
          },
          checkSender: 'all',
          checkReceiver: 'all',
          transactionVolumeThreshold: {
            EUR: 300,
          },
        } as TransactionsVolumeRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Skip transactions with non-target state',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Skip transactions with non-target state',
        transactions: [
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-2',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T11:59:59.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '2-1',
            destinationUserId: '2-3',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
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
        ruleImplementationName: 'transactions-volume',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'minute',
          },
          checkSender: 'all',
          checkReceiver: 'all',
          transactionVolumeThreshold: {
            EUR: 300,
          },
        } as TransactionsVolumeRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Anonymous sender (no identifier) - hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: undefined,
            originAmountDetails: undefined,
            destinationUserId: '1-1',
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: undefined,
            originAmountDetails: undefined,
            destinationUserId: '1-1',
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Anonymous sender - hit',
        transactions: [
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-1',
            },
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationUserId: '2-1',
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: undefined,
            originPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-1',
            },
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationUserId: '2-2',
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Anonymous receiver (no identifier) - hit',
        transactions: [
          getTestTransaction({
            originUserId: '3-1',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationUserId: undefined,
            destinationPaymentDetails: undefined,
            destinationAmountDetails: undefined,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '3-1',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationUserId: undefined,
            destinationPaymentDetails: undefined,
            destinationAmountDetails: undefined,
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true],
      },
      {
        name: 'Anonymous receiver - hit',
        transactions: [
          getTestTransaction({
            originUserId: '4-1',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationUserId: undefined,
            destinationPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-2',
            },
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '4-2',
            originAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },
            destinationUserId: undefined,
            destinationPaymentDetails: {
              method: 'CARD',
              cardFingerprint: 'fingerprint-2',
            },
            destinationAmountDetails: {
              transactionCurrency: 'EUR',
              transactionAmount: 200,
            },

            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
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

  describe('Match Payment Method Details', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume',
        defaultParameters: {
          timeWindow: {
            units: 3600,
            granularity: 'second',
            rollingBasis: false,
          },
          checkSender: 'all',
          checkReceiver: 'all',
          transactionVolumeThreshold: {
            EUR: 150,
          },
          originMatchPaymentMethodDetails: true,
          destinationMatchPaymentMethodDetails: true,
        } as TransactionsVolumeRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Skip transactions with non-target paymentMethod',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_1 as IBANDetails,
            destinationPaymentDetails:
              TEST_TRANSACTION_METHOD_IBAN_2 as IBANDetails,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-4',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_1 as IBANDetails,
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-5',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationPaymentDetails:
              TEST_TRANSACTION_METHOD_IBAN_1 as IBANDetails,
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-5',
            destinationUserId: '1-1',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationPaymentDetails:
              TEST_TRANSACTION_METHOD_IBAN_1 as IBANDetails,
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-2',
            destinationUserId: '1-7',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_1 as IBANDetails,
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-2',
            destinationUserId: '1-8',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_TRANSACTION_METHOD_IBAN_2 as IBANDetails,
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, true, true, true, true],
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

  describe('Initial transactions', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-volume',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
            rollingBasis: true,
          },
          checkSender: 'all',
          checkReceiver: 'all',
          transactionVolumeThreshold: {
            EUR: 50,
          },
          initialTransactions: 1,
        } as TransactionsVolumeRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'rule is hit after the past transactions is more than initialTransactions',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-3',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1-4',
            destinationUserId: '1-2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, true, true],
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
