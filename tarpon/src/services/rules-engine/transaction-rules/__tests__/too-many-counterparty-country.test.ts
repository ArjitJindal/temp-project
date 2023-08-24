import { TooManyCounterpartyCountryRuleParameters } from '../too-many-counterparty-country'
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
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()
withFeatureHook(['RULES_ENGINE_V2'])

ruleVariantsTest(false, () => {
  describe('R-123 description formatting', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'too-many-counterparty-country',
        defaultParameters: {
          transactionsLimit: 2,
          timeWindow: {
            units: 5,
            granularity: 'second',
          },
          checkSender: 'all',
          checkReceiver: 'all',
        } as TooManyCounterpartyCountryRuleParameters,
      },
    ])
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          originAmountDetails: {
            country: 'PK',
            transactionAmount: 800,
            transactionCurrency: 'PKR',
          },
          timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
        }),
        getTestTransaction({
          originAmountDetails: {
            country: 'AF',
            transactionAmount: 800,
            transactionCurrency: 'AFN',
          },
          timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
        }),
        getTestTransaction({
          originAmountDetails: {
            country: 'RU',
            transactionAmount: 800,
            transactionCurrency: 'AFN',
          },
          timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-123').descriptionTemplate,
      },
      [
        null,
        null,
        'Sender is sending funds from more than 2 unique country within 5 seconds.',
      ]
    )
  })

  describe('Core logic', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'too-many-counterparty-country',
        defaultParameters: {
          transactionsLimit: 2,
          timeWindow: {
            units: 5,
            granularity: 'second',
          },
          checkSender: 'all',
          checkReceiver: 'all',
        } as TooManyCounterpartyCountryRuleParameters,
      },
    ])
    describe.each<TransactionRuleTestCase>([
      {
        name: 'Exceeded transaction with same country - not hit',
        transactions: [
          getTestTransaction({
            originAmountDetails: {
              country: 'GB',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-01-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'GB',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-01-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'GB',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-01-01T00:00:02.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, false],
      },
      {
        name: 'Exceeded transaction with different country - hit',
        transactions: [
          getTestTransaction({
            originAmountDetails: {
              country: 'AW',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-02-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'AU',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-02-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'BT',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-02-01T00:00:02.000Z').valueOf(),
          }),
        ],
        expectedHits: [false, false, true],
      },
      {
        name: 'Exceeded transaction with two different country - not hit',
        transactions: [
          getTestTransaction({
            originAmountDetails: {
              country: 'IO',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-03-01T00:00:00.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'BR',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-03-01T00:00:01.000Z').valueOf(),
          }),
          getTestTransaction({
            originAmountDetails: {
              country: 'BR',
              transactionAmount: 800,
              transactionCurrency: 'GBP',
            },
            timestamp: dayjs('2022-03-01T00:00:02.000Z').valueOf(),
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
