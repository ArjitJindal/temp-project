import { TransactionReferenceKeywordRuleParameters } from '../transaction-reference-keyword'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import {
  setUpRulesHooks,
  createTransactionRuleTestCase,
  TransactionRuleTestCase,
} from '@/test-utils/rule-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

const TEST_TENANT_ID = getTestTenantId()

dynamoDbSetupHook()

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
