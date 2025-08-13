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

const ROUND: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 100,
}
const NON_ROUND: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 123,
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: false }, () => {
  describe('Round-Amount Anomaly (stddev round percent)', () => {
    const now = dayjs().startOf('day')
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'round-amount-anomaly',
        defaultParameters: {},
      },
    ])

    const baseline = Array.from({ length: 10 }).map((_, i) =>
      getTestTransaction({
        originUserId: 'u',
        destinationUserId: 'v',
        originAmountDetails: NON_ROUND,
        timestamp: now.subtract(40 + i, 'day').valueOf(),
      })
    )

    const periodRoundy = Array.from({ length: 9 }).map((_, i) =>
      getTestTransaction({
        originUserId: 'u',
        destinationUserId: 'v',
        originAmountDetails: i < 8 ? ROUND : NON_ROUND,
        timestamp: now.subtract(1, 'day').add(i, 'hour').valueOf(),
      })
    )

    const finalTxn = getTestTransaction({
      originUserId: 'u',
      destinationUserId: 'v',
      originAmountDetails: NON_ROUND,
      timestamp: now.valueOf(),
    })

    const transactions = [...baseline, ...periodRoundy, finalTxn]
    const expectedHits: boolean[] = [
      ...baseline.map(() => false),
      ...periodRoundy.map((_, i) => (i === 0 ? false : true)),
      true,
    ]

    const cases: TransactionRuleTestCase[] = [
      {
        name: 'flags anomaly when 30d round percent >> 90d baseline',
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
