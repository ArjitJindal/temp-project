import { TransactionReferenceKeywordRuleParameters } from '../transaction-reference-keyword'
import { getRuleByRuleId } from '../library'
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

dynamoDbSetupHook()

ruleVariantsTest({ v8: true, aggregation: false }, () => {
  const TEST_TENANT_ID = getTestTenantId()

  setUpRulesHooks(TEST_TENANT_ID, [
    {
      type: 'TRANSACTION',
      ruleImplementationName: 'transaction-reference-keyword',
      defaultParameters: {
        keywords: ['keyword1', 'keyword2', 'keyword3', 'KEYWORD4'],
      } as TransactionReferenceKeywordRuleParameters,
      defaultAction: 'FLAG',
    },
  ])

  describe('R-24 description formatting', () => {
    testRuleDescriptionFormatting(
      'basic case',
      TEST_TENANT_ID,
      [
        getTestTransaction({
          reference: 'A reference with keyword1',
        }),
      ],
      {
        descriptionTemplate: getRuleByRuleId('R-24').descriptionTemplate,
      },
      ['Keyword “keyword1” in reference is blacklisted.']
    )
  })

  describe.each<TransactionRuleTestCase>([
    {
      name: 'reference contains a target keyword - hit',
      transactions: [
        getTestTransaction({
          reference: 'A reference with keyword1',
        }),
        getTestTransaction({
          reference: '   keyword2 in a reference',
        }),
        getTestTransaction({
          reference: 'keyword3   ',
        }),
        getTestTransaction({
          reference: 'case    insensitive  keYworD4',
        }),
      ],
      expectedHits: [true, true, true, true],
    },
    {
      name: "reference doesn't contain a target keyword - not hit",
      transactions: [
        getTestTransaction({
          reference: 'A reference with keyword 1',
        }),
        getTestTransaction({
          reference: 'keyword 2 in a reference',
        }),
        getTestTransaction({
          reference: 'keyword 3',
        }),
        getTestTransaction({
          reference: undefined,
        }),
      ],
      expectedHits: [false, false, false, false],
    },
    {
      name: 'reference contains a target keyword (substring) - not hit',
      transactions: [
        getTestTransaction({
          reference: 'aaakeyword1aaa',
        }),
        getTestTransaction({
          reference: 'aaakeyword1',
        }),
        getTestTransaction({
          reference: 'keyword3aaa',
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

  describe('hitDistance parameter', () => {
    const TEST_TENANT_ID = getTestTenantId()
    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transaction-reference-keyword',
        defaultParameters: {
          keywords: ['keyword1', 'keyword2'],
          allowedDistancePercentage: 30,
        } as TransactionReferenceKeywordRuleParameters,
        defaultAction: 'FLAG',
      },
    ])

    describe.each<TransactionRuleTestCase>([
      {
        name: 'reference contains a target keyword,less than allowedDistancePercentage - hit',
        transactions: [
          getTestTransaction({
            reference: 'A reference with ttyword1',
          }),
          getTestTransaction({
            reference: '   teyword2 in a reference',
          }),
        ],
        expectedHits: [true, true],
      },
      {
        name: "reference doesn't contain a target keyword, more than allowedDistancePercentage - not hit",
        transactions: [
          getTestTransaction({
            reference: 'A reference with tyoword1',
          }),
          getTestTransaction({
            reference: 'ygturd2 in a reference',
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
