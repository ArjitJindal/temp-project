import { TooManyTransactionsToHighRiskCountryRuleParameters } from '../too-many-transactions-to-high-risk-country'
import { getRuleByRuleId } from '../library'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
  testRuleDescriptionFormatting,
  ruleVariantsTest,
  testAggregationRebuild,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const DEFAULT_RULE_PARAMETERS: TooManyTransactionsToHighRiskCountryRuleParameters =
  {
    transactionsLimit: 2,
    timeWindow: {
      units: 5,
      granularity: 'second',
    },
    highRiskCountries: ['DE', 'TR', 'PK'],
    checkSender: 'all',
    checkReceiver: 'all',
  }

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: true }, () => {
  describe('R-77 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'too-many-transactions-to-high-risk-country',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
      },
    ])
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
        descriptionTemplate: getRuleByRuleId('R-77').descriptionTemplate,
      },
      [
        null,
        null,
        'Sender performed more than 2 transactions with sending country which is high risk in 5 seconds.',
      ]
    )
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'too-many-transactions-to-high-risk-country',
        defaultParameters: DEFAULT_RULE_PARAMETERS,
      },
    ])

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
            timestamp: dayjs('2022-01-02T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'TR',
              transactionAmount: 800,
              transactionCurrency: 'TRY',
            },
            timestamp: dayjs('2022-01-02T00:00:01.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false],
      },
      {
        name: 'Exceeded Transaction from low risk origin country - not hit',
        transactions: [
          getTestTransaction({
            originAmountDetails: {
              country: 'US',
              transactionAmount: 800,
              transactionCurrency: 'USD',
            },
            timestamp: dayjs('2022-01-03T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'US',
              transactionAmount: 800,
              transactionCurrency: 'USD',
            },
            timestamp: dayjs('2022-01-03T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'US',
              transactionAmount: 800,
              transactionCurrency: 'USD',
            },
            timestamp: dayjs('2022-01-03T00:00:02.000Z').valueOf(),
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
            timestamp: dayjs('2022-01-04T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            destinationAmountDetails: {
              country: 'DE',
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            timestamp: dayjs('2022-01-04T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            destinationAmountDetails: {
              country: 'DE',
              transactionAmount: 800,
              transactionCurrency: 'EUR',
            },
            timestamp: dayjs('2022-01-04T00:00:02.000Z').valueOf(),
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
              transactionCurrency: 'PKR',
            },
            destinationAmountDetails: {
              country: 'US',
              transactionAmount: 800,
              transactionCurrency: 'USD',
            },
            timestamp: dayjs('2022-01-05T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'AF',
              transactionAmount: 800,
              transactionCurrency: 'PKR',
            },
            destinationAmountDetails: {
              country: 'US',
              transactionAmount: 800,
              transactionCurrency: 'USD',
            },
            timestamp: dayjs('2022-01-05T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'AF',
              transactionAmount: 800,
              transactionCurrency: 'PKR',
            },
            destinationAmountDetails: {
              country: 'US',
              transactionAmount: 800,
              transactionCurrency: 'USD',
            },
            timestamp: dayjs('2022-01-05T00:00:02.000Z').valueOf(),
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
            timestamp: dayjs('2022-01-06T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            destinationAmountDetails: {
              country: 'RU',
              transactionAmount: 800,
              transactionCurrency: 'RUB',
            },
            timestamp: dayjs('2022-01-06T00:00:01.000Z').valueOf(),
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

    describe('Check for EEA group of country', () => {
      const TEST_TENANT_ID = getTestTenantId()

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
            highRiskCountries: ['DE', 'TR', 'PK', 'EEA'],
            checkSender: 'all',
            checkReceiver: 'all',
          } as TooManyTransactionsToHighRiskCountryRuleParameters,
        },
      ])

      describe.each<TransactionRuleTestCase>([
        {
          name: 'Exceeded transaction from EEA - as a group of country - hit',
          transactions: [
            getTestTransaction({
              originAmountDetails: {
                country: 'SE',
                transactionAmount: 800,
                transactionCurrency: 'RUB',
              },
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            }),
            getTestTransaction({
              originAmountDetails: {
                country: 'SE',
                transactionAmount: 800,
                transactionCurrency: 'RUB',
              },
              timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
            }),
            getTestTransaction({
              originAmountDetails: {
                country: 'SE',
                transactionAmount: 800,
                transactionCurrency: 'RUB',
              },
              timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
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

    describe('Exclusive high risk countries', () => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'too-many-transactions-to-high-risk-country',
          defaultParameters: {
            transactionsLimit: 1,
            timeWindow: {
              units: 5,
              granularity: 'second',
            },
            highRiskCountries: ['DE'],
            highRiskCountriesExclusive: ['EEA'],
            checkSender: 'all',
            checkReceiver: 'all',
          } as TooManyTransactionsToHighRiskCountryRuleParameters,
        },
      ])

      describe.each<TransactionRuleTestCase>([
        {
          name: 'Exceeded transaction from outside of EEA - hit',
          transactions: [
            getTestTransaction({
              originAmountDetails: {
                country: 'IT',
                transactionAmount: 100,
                transactionCurrency: 'EUR',
              },
              timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
            }),
            getTestTransaction({
              originAmountDetails: {
                country: 'DE',
                transactionAmount: 100,
                transactionCurrency: 'EUR',
              },
              timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
            }),
            getTestTransaction({
              originAmountDetails: {
                country: 'US',
                transactionAmount: 100,
                transactionCurrency: 'USD',
              },
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
})

const TEST_TENANT_ID = getTestTenantId()
testAggregationRebuild(
  TEST_TENANT_ID,
  {
    type: 'TRANSACTION',
    ruleImplementationName: 'too-many-transactions-to-high-risk-country',
    defaultParameters: {
      transactionsLimit: 2,
      timeWindow: {
        units: 1,
        granularity: 'day',
        rollingBasis: true,
      },
      highRiskCountries: ['DE', 'TR', 'PK'],
      checkSender: 'all',
      checkReceiver: 'all',
    },
  },
  [
    getTestTransaction({
      originUserId: '1',
      originAmountDetails: {
        country: 'DE',
        transactionAmount: 800,
        transactionCurrency: 'EUR',
      },
      timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      originAmountDetails: {
        country: 'TR',
        transactionAmount: 800,
        transactionCurrency: 'EUR',
      },
      timestamp: dayjs('2022-01-01T00:30:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      originAmountDetails: {
        country: 'JP',
        transactionAmount: 800,
        transactionCurrency: 'EUR',
      },
      timestamp: dayjs('2022-01-01T02:00:00.000Z').valueOf(),
    }),
    getTestTransaction({
      originUserId: '1',
      originAmountDetails: {
        country: 'DE',
        transactionAmount: 800,
        transactionCurrency: 'EUR',
      },
      timestamp: dayjs('2022-01-01T03:00:00.000Z').valueOf(),
    }),
  ],
  {
    origin: [
      { sendingCount: 2, hour: '2022010100' },
      { sendingCount: 1, hour: '2022010103' },
    ],
    destination: undefined,
  }
)
