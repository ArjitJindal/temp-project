import { getRuleByRuleId } from '../library'
import { TransactionsRoundValueVelocityRuleParameters } from '../transactions-round-value-velocity'
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
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

withFeatureHook(['RULES_ENGINE_V2'])

const TEST_TRANSACTION_AMOUNT_100: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

const TEST_TRANSACTION_AMOUNT_101: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 101,
}

const TEST_TRANSACTION_AMOUNT_200: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 200,
}

const TEST_TRANSACTION_AMOUNT_300: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 300,
}

const TEST_PAYMENT_DETAILS_1: IBANDetails = {
  IBAN: 'NL02ABNA0123456789',
  method: 'IBAN',
  BIC: 'NABANL2A',
}

const TEST_PAYMENT_DETAILS_2: IBANDetails = {
  IBAN: 'AT02ABNA0123456789',
  method: 'IBAN',
  BIC: 'ABNABE2A',
}

const TEST_PAYMENT_DETAILS_3: IBANDetails = {
  IBAN: 'PT02ABNA0123456789',
  method: 'IBAN',
  BIC: 'PTBANL2A',
}

dynamoDbSetupHook()

ruleVariantsTest(false, () => {
  describe('R-130 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-round-value-velocity',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          transactionsLimit: 1,
        } as TransactionsRoundValueVelocityRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    testRuleDescriptionFormatting(
      'first',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '1',
          destinationUserId: '3',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originUserId: '4',
          destinationUserId: '2',
          originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
          timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-130').descriptionTemplate,
      },
      [
        null,
        'Sender is sending 1 or more transactions as round values ending in 00.00 (hundreds without cents) within time 1 day.',
        'Receiver is receiving 1 or more transactions as round values ending in 00.00 (hundreds without cents) within time 1 day.',
      ]
    )
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-round-value-velocity',
        defaultParameters: {
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          transactionsLimit: 1,
        } as TransactionsRoundValueVelocityRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Too many round values',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '3',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '4',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_101,
            timestamp: dayjs('2000-01-01T01:00:03.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '5',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_300,
            timestamp: dayjs('2000-01-01T01:00:04.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true, false, true],
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
  describe('Optional parameter - Same Amount', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-round-value-velocity',
        defaultParameters: {
          sameAmount: true,
          transactionsLimit: 1,
          timeWindow: {
            units: 5,
            granularity: 'second',
          },
          checkSender: 'all',
          checkReceiver: 'all',
        } as TransactionsRoundValueVelocityRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Amount and currency are same - hit',
        transactions: [
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
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
  })

  describe('Optional parameter - Match payment details', () => {
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-round-value-velocity',
        defaultParameters: {
          originMatchPaymentMethodDetails: true,
          transactionsLimit: 2,
          timeWindow: {
            units: 10,
            granularity: 'second',
          },
          checkSender: 'sending',
        } as TransactionsRoundValueVelocityRuleParameters,
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Payment details are same - hit',
        transactions: [
          getTestTransaction({
            transactionId: '1-1',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_PAYMENT_DETAILS_1,
            destinationPaymentDetails: TEST_PAYMENT_DETAILS_2,
            timestamp: dayjs('2000-01-01T01:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '1-2',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_200,
            originPaymentDetails: TEST_PAYMENT_DETAILS_1,
            destinationPaymentDetails: TEST_PAYMENT_DETAILS_3,
            timestamp: dayjs('2000-01-01T01:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '1-3',
            originUserId: '6',
            destinationUserId: '4',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_PAYMENT_DETAILS_2,
            destinationPaymentDetails: TEST_PAYMENT_DETAILS_3,
            timestamp: dayjs('2000-01-01T01:00:02.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '1-4',
            originUserId: '1',
            destinationUserId: '2',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_PAYMENT_DETAILS_1,
            destinationPaymentDetails: TEST_PAYMENT_DETAILS_2,
            timestamp: dayjs('2000-01-01T01:00:03.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '1-5',
            originUserId: '1',
            destinationUserId: '4',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_PAYMENT_DETAILS_2,
            destinationPaymentDetails: TEST_PAYMENT_DETAILS_3,
            timestamp: dayjs('2000-01-01T01:00:04.000Z').valueOf(),
          }),
          getTestTransaction({
            transactionId: '1-6',
            originUserId: '6',
            destinationUserId: '4',
            originAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            destinationAmountDetails: TEST_TRANSACTION_AMOUNT_100,
            originPaymentDetails: TEST_PAYMENT_DETAILS_2,
            destinationPaymentDetails: TEST_PAYMENT_DETAILS_3,
            timestamp: dayjs('2000-01-01T01:00:05.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false, true, false, true],
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
