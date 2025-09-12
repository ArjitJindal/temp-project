import { UserTransactionStatsTimeGroup } from '../user-transaction-stats-by-time'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { bulkVerifyTransactions } from '@/test-utils/rule-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import dayjs from '@/utils/dayjs'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { withLocalChangeHandler } from '@/utils/local-change-handler'

function toMap(obj: object) {
  return new Map(Object.entries(obj))
}

dynamoDbSetupHook()

describe('UserTransactionStatsTimeGroup aggregator', () => {
  withLocalChangeHandler()

  test('Should rebuild the aggregation data for the user for the current year', async () => {
    const tenantId = getTestTenantId()
    const aggregator = new UserTransactionStatsTimeGroup(
      tenantId,
      getDynamoDbClient()
    )
    const transactions = [
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 100,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-01-01T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: undefined,
        destinationUserId: '1',
        destinationAmountDetails: {
          transactionAmount: 200,
          transactionCurrency: 'EUR',
        },
        timestamp: dayjs('2023-01-02T12:00:00.000Z').valueOf(),
      }),
      getTestTransaction({
        originUserId: '1',
        originAmountDetails: {
          transactionAmount: 1000,
          transactionCurrency: 'EUR',
        },
        destinationUserId: undefined,
        timestamp: dayjs('2023-03-01T12:00:00.000Z').valueOf(),
      }),
    ]
    await bulkVerifyTransactions(tenantId, transactions)

    const result = await aggregator.rebuildAggregation('1', {
      now: dayjs('2023-02-01').valueOf(),
    })
    expect(result).toEqual({
      day: {
        '2023-03-01': {
          sendingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          sendingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 1000,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 1000,
              transactionCurrency: 'EUR',
            },
          }),
          receivingTransactionsCount: new Map(),
          receivingTransactionsAmount: new Map(),
        },
        '2023-01-02': {
          sendingTransactionsCount: new Map(),
          sendingTransactionsAmount: new Map(),
          receivingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          receivingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
          }),
        },
        '2023-01-01': {
          sendingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          sendingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
          }),
          receivingTransactionsCount: new Map(),
          receivingTransactionsAmount: new Map(),
        },
      },
      week: {
        '2023-W9': {
          sendingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          sendingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 1000,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 1000,
              transactionCurrency: 'EUR',
            },
          }),
          receivingTransactionsCount: new Map(),
          receivingTransactionsAmount: new Map(),
        },
        '2023-W1': {
          sendingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          sendingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
          }),
          receivingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          receivingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
          }),
        },
      },
      month: {
        '2023-03': {
          sendingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          sendingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 1000,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 1000,
              transactionCurrency: 'EUR',
            },
          }),
          receivingTransactionsCount: new Map(),
          receivingTransactionsAmount: new Map(),
        },
        '2023-01': {
          sendingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          sendingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 100,
              transactionCurrency: 'EUR',
            },
          }),
          receivingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          receivingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
          }),
        },
      },
      year: {
        '2023': {
          sendingTransactionsCount: toMap({
            ALL: 2,
            CARD: 2,
          }),
          sendingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 1100,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 1100,
              transactionCurrency: 'EUR',
            },
          }),
          receivingTransactionsCount: toMap({
            ALL: 1,
            CARD: 1,
          }),
          receivingTransactionsAmount: toMap({
            ALL: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
            CARD: {
              transactionAmount: 200,
              transactionCurrency: 'EUR',
            },
          }),
        },
      },
    })
  })
})
