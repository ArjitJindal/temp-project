import { TooManyTransactionsToHighRiskCountryRuleParameters } from '../too-many-transactions-to-high-risk-country'
import dayjs from '@/utils/dayjs'
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
    ruleImplementationName: 'too-many-transactions-to-high-risk-country',
    defaultParameters: {
      transactionsLimit: 2,
      timeWindow: {
        units: 5,
        granularity: 'second',
      },
      highRiskCountries: ['DE', 'TR', 'PK'],
      checkSender: 'all',
      checkReceiver: 'all',
    } as TooManyTransactionsToHighRiskCountryRuleParameters,
  },
])

describe('R-77 description formatting', () => {
  const descriptionTemplate = `User receives or send >= x transactions in time t from/to high risk country`

  testRuleDescriptionFormatting(
    'basic case',
    TEST_TENANT_ID,
    [
      getTestTransaction({
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
      }),
    ],
    {
      descriptionTemplate,
    },
    [
      null,
      null,
      'User receives or send >= x transactions in time t from/to high risk country',
    ]
  )
})

describe.each<TransactionRuleTestCase>([
  {
    name: 'Exceeded Transaction from high risk origin country - hit',
    transactions: [
      getTestTransaction({
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
      }),
    ],
    expectedHits: [false, false, true],
  },
  {
    name: 'Not exceeded transaction from high risk origin country - not hit',
    transactions: [
      getTestTransaction({
        originAmountDetails: {
          country: 'TR',
          transactionAmount: 800,
          transactionCurrency: 'TRY',
        },
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'TR',
          transactionAmount: 800,
          transactionCurrency: 'TRY',
        },
        timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
      }),
    ],
    expectedHits: [false, false],
  },
  {
    name: 'Exceeded Transaction from low risk origin country - not hit',
    transactions: [
      getTestTransaction({
        originAmountDetails: {
          country: 'USA',
          transactionAmount: 800,
          transactionCurrency: 'USD',
        },
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'USA',
          transactionAmount: 800,
          transactionCurrency: 'USD',
        },
        timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'USA',
          transactionAmount: 800,
          transactionCurrency: 'USD',
        },
        timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
      }),
    ],
    expectedHits: [false, false, false],
  },
  {
    name: 'Exceeded Transaction from high risk destination country - hit',
    transactions: [
      getTestTransaction({
        destinationAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        destinationAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
      }),
      getTestTransaction({
        destinationAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
      }),
    ],
    expectedHits: [false, false, true],
  },

  {
    name: 'Exceeded Transaction from low risk destination country - not hit',
    transactions: [
      getTestTransaction({
        originAmountDetails: {
          country: 'AF',
          transactionAmount: 800,
          transactionCurrency: 'PNR',
        },
        destinationAmountDetails: {
          country: 'USA',
          transactionAmount: 800,
          transactionCurrency: 'USD',
        },
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'AF',
          transactionAmount: 800,
          transactionCurrency: 'PNR',
        },
        destinationAmountDetails: {
          country: 'USA',
          transactionAmount: 800,
          transactionCurrency: 'USD',
        },
        timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
      }),
      getTestTransaction({
        originAmountDetails: {
          country: 'AF',
          transactionAmount: 800,
          transactionCurrency: 'PNR',
        },
        destinationAmountDetails: {
          country: 'USA',
          transactionAmount: 800,
          transactionCurrency: 'USD',
        },
        timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
      }),
    ],
    expectedHits: [false, false, false],
  },
  {
    name: 'Not Exceeded Transaction from low risk destination country - not hit',
    transactions: [
      getTestTransaction({
        destinationAmountDetails: {
          country: 'RU',
          transactionAmount: 800,
          transactionCurrency: 'RUB',
        },
        timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        destinationAmountDetails: {
          country: 'RU',
          transactionAmount: 800,
          transactionCurrency: 'RUB',
        },
        timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
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
