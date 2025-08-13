import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  TransactionRuleTestCase,
  createTransactionRuleTestCase,
  ruleVariantsTest,
  setUpRulesHooks,
} from '@/test-utils/rule-test-utils'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'

const SMALL: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}
const LARGE: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 10000,
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: false }, () => {
  describe('Average Transaction Value Spike (stddev avg amount)', () => {
    const now = dayjs().startOf('day')
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'average-transaction-value-spike',
        defaultParameters: {},
      },
    ])

    const baseline = Array.from({ length: 10 }).map((_, i) =>
      getTestTransaction({
        originUserId: 'u',
        destinationUserId: 'v',
        originAmountDetails: SMALL,
        timestamp: now.subtract(40 + i, 'day').valueOf(),
      })
    )

    const periodHighAvg = [
      getTestTransaction({
        originUserId: 'u',
        destinationUserId: 'v',
        originAmountDetails: LARGE,
        timestamp: now.subtract(1, 'day').valueOf(),
      }),
      getTestTransaction({
        originUserId: 'u',
        destinationUserId: 'v',
        originAmountDetails: LARGE,
        timestamp: now.subtract(1, 'day').add(1, 'hour').valueOf(),
      }),
    ]

    const triggerAtNow = getTestTransaction({
      originUserId: 'u',
      destinationUserId: 'v',
      originAmountDetails: SMALL,
      timestamp: now.valueOf(),
    })

    const transactions = [...baseline, ...periodHighAvg, triggerAtNow]
    const expectedHits: boolean[] = [
      ...baseline.map(() => false),
      false, // first large txn may not cross 2σ immediately
      true, // second large txn crosses the threshold
      true, // final now still anomalous
    ]

    const cases: TransactionRuleTestCase[] = [
      {
        name: 'flags anomaly when 30d avg amount >> 90d baseline',
        transactions,
        expectedHits,
      },
    ]

    describe.each(cases)(`%s`, ({ name, transactions, expectedHits }) => {
      createTransactionRuleTestCase(
        name,
        TEST_TENANT_ID,
        transactions,
        expectedHits
      )
    })
  })
})
