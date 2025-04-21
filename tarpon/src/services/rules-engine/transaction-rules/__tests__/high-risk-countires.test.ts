import { HighRiskCountryRuleParameters } from '../high-risk-countries'
import { getRuleByRuleId } from '../library'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  TransactionRuleTestCase,
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
  testRuleDescriptionFormatting,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

dynamoDbSetupHook()
ruleVariantsTest({ aggregation: false, v8: true }, () => {
  describe('Core logic high-risk-countries', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'high-risk-countries',
        defaultParameters: {
          highRiskCountries: ['US', 'CN', 'RU', 'IR', 'IQ'],
        } as HighRiskCountryRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe('R-14 description formatting', () => {
      testRuleDescriptionFormatting(
        'sender',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
              country: 'US',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
              country: 'TR',
            },
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-14').descriptionTemplate,
        },
        ['Sender’s country (United States of America) is a High Risk.']
      )

      testRuleDescriptionFormatting(
        'receiver',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
              country: 'TR',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
              country: 'US',
            },
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-14').descriptionTemplate,
        },
        ['Receiver’s country (United States of America) is a High Risk.']
      )

      testRuleDescriptionFormatting(
        'sender and receiver',
        TEST_TENANT_ID,
        [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
              country: 'US',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
              country: 'US',
            },
          }),
        ],
        {
          descriptionTemplate: getRuleByRuleId('R-14').descriptionTemplate,
        },
        [
          'Sender’s country (United States of America) is a High Risk. Receiver’s country (United States of America) is a High Risk.',
        ]
      )
    })

    describe.each<TransactionRuleTestCase>([
      {
        name: 'Sender high/very high risk and receiver low/medium risk country',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
              country: 'US',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
              country: 'TR',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'Sender low/medium risk and receiver high/very high risk country',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
              country: 'TR',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
              country: 'US',
            },
          }),
        ],
        expectedHits: [true],
      },
      {
        name: 'Both sender and receiver, No hit',
        transactions: [
          getTestTransaction({
            originUserId: '1-1',
            destinationUserId: '1-2',
            originAmountDetails: {
              transactionAmount: 800,
              transactionCurrency: 'EUR',
              country: 'TR',
            },
            destinationAmountDetails: {
              transactionAmount: 68351.34,
              transactionCurrency: 'TRY',
              country: 'TR',
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
