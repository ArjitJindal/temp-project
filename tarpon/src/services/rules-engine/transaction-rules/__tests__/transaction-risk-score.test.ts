import { TransactionRiskScoreRuleParameters } from '../transaction-risk-score'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  TransactionRuleTestCase,
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'

dynamoDbSetupHook()
withFeatureHook(['RISK_SCORING', 'RISK_LEVELS'])

ruleVariantsTest({ aggregation: true }, () => {
  describe('Core logic', () => {
    describe.each<TransactionRuleTestCase<TransactionRiskScoreRuleParameters>>([
      {
        name: 'Rule with risk score threshold of 95',
        ruleParams: { riskScoreThreshold: 95 },
        transactions: [getTestTransaction({ transactionId: '1' })],
        expectedHits: [false],
      },
      {
        name: 'Rule with risk score threshold of 80',
        ruleParams: { riskScoreThreshold: 80 },
        transactions: [getTestTransaction({ transactionId: '1' })],
        expectedHits: [true],
      },
      {
        name: 'Rule with risk score threshold of 90',
        ruleParams: { riskScoreThreshold: 90 },
        transactions: [getTestTransaction({ transactionId: '1' })],
        expectedHits: [true],
      },
    ])('Rule variants', ({ expectedHits, name, transactions, ruleParams }) => {
      const TEST_TENANT_ID = getTestTenantId()

      setUpRulesHooks(TEST_TENANT_ID, [
        {
          type: 'TRANSACTION',
          ruleImplementationName: 'transaction-risk-score',
          defaultParameters: { ...ruleParams },
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
})
