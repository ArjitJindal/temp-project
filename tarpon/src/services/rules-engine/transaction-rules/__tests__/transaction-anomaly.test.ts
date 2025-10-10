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

const AMOUNT_HIGH: TransactionAmountDetails = {
  transactionCurrency: 'EUR',
  transactionAmount: 10000,
}

dynamoDbSetupHook()

ruleVariantsTest({ aggregation: true, v8: false }, () => {
  describe('Transaction Anomaly (stddev amount)', () => {
    // Anchor: evaluate each transaction at its own timestamp (no fixed date)
    const now = dayjs().startOf('day')
    const TEST_TENANT_ID = getTestTenantId()

    setUpRulesHooks(TEST_TENANT_ID, [
      {
        type: 'TRANSACTION',
        ruleImplementationName: 'transaction-anomaly',
        defaultParameters: {},
      },
    ])

    // Seed baseline days between now-20 and now-11 so they:
    // - fall inside the 30-day baseline window, and
    // - are outside the last-7-days period window.
    const baselineDays = Array.from({ length: 10 }).map((_, i) =>
      getTestTransaction({
        originUserId: 'sender1',
        destinationUserId: 'receiver1',
        originAmountDetails: AMOUNT_LOW,
        timestamp: now.subtract(11 + i, 'day').valueOf(),
      })
    )

    // Create an outlier on the previous day (now-1). When evaluating at now,
    // this outlier will be included in the last-7-days period and lift the
    // period mean above baseline mean + 2*stddev.
    const periodOutlierDay = getTestTransaction({
      originUserId: 'sender1',
      destinationUserId: 'receiver1',
      originAmountDetails: AMOUNT_HIGH,
      timestamp: now.subtract(1, 'day').valueOf(),
    })

    // Final transaction at now triggers the anomaly detection because the
    // outlier (now-1) is included in the period window when evaluating this txn.
    const triggerAtNow = getTestTransaction({
      originUserId: 'sender1',
      destinationUserId: 'receiver1',
      originAmountDetails: AMOUNT_LOW,
      timestamp: now.valueOf(),
    })

    const transactions = [...baselineDays, periodOutlierDay, triggerAtNow]

    // Expect no hits during baseline seeding, no hit on the outlier day itself
    // (the current txn isn’t included in its own evaluation), and a single hit
    // at the final txn when the outlier is reflected in the 30-day period mean.
    const expectedHits: boolean[] = [
      ...baselineDays.map(() => false),
      false, // outlier day itself won't include itself in computation
      true, // now should detect anomaly (period mean high vs baseline)
    ]

    const cases: TransactionRuleTestCase[] = [
      {
        name: 'flags anomaly when 30d mean >> 90d baseline',
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
