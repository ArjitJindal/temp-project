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

const AMOUNT_LOW: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: false }, () => {
  describe('Transactions Frequency Anomaly (stddev count)', () => {
    const now = dayjs().startOf('day')
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transactions-frequency-anomaly',
        defaultParameters: {},
      },
    ])

    const baseline = Array.from({ length: 10 }).map((_, i) =>
      getTestTransaction({
        originUserId: 'u',
        destinationUserId: 'v',
        originAmountDetails: AMOUNT_LOW,
        timestamp: now.subtract(40 + i, 'day').valueOf(),
      })
    )

    const periodMany = Array.from({ length: 8 }).map((_, i) =>
      getTestTransaction({
        originUserId: 'u',
        destinationUserId: 'v',
        originAmountDetails: AMOUNT_LOW,
        timestamp: now.subtract(1, 'day').add(i, 'hour').valueOf(),
      })
    )

    const finalTxn = getTestTransaction({
      originUserId: 'u',
      destinationUserId: 'v',
      originAmountDetails: AMOUNT_LOW,
      timestamp: now.valueOf(),
    })

    const transactions = [...baseline, ...periodMany, finalTxn]
    const expectedHits: boolean[] = [
      ...baseline.map(() => false),
      ...periodMany.map((_, i) => (i < 2 ? false : true)),
      true,
    ]

    const cases: TransactionRuleTestCase[] = [
      {
        name: 'flags anomaly when 30d count >> 90d baseline',
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
