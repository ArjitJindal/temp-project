import { TransactionTimeRangeRuleFilter } from '../transaction-time-range'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import dayjs from '@/utils/dayjs'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()
filterVariantsTest({ v8: true }, () => {
  test('Transactions in time range for same date', async () => {
    expect(
      await new TransactionTimeRangeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            timestamp: dayjs('2022-01-06T03:00:00.000Z').valueOf(),
          }),
        },
        {
          transactionTimeRange24hr: {
            startTime: {
              utcHours: 1,
              utcMinutes: 30,
            },
            endTime: {
              utcHours: 5,
              utcMinutes: 0,
            },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transactions in time range for transaction date greater than filter', async () => {
    expect(
      await new TransactionTimeRangeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            timestamp: dayjs('2022-02-06T03:00:00.000Z').valueOf(),
          }),
        },
        {
          transactionTimeRange24hr: {
            startTime: {
              utcHours: 1,
              utcMinutes: 30,
            },
            endTime: {
              utcHours: 5,
              utcMinutes: 0,
            },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transactions in time range for transaction date equal to end time', async () => {
    expect(
      await new TransactionTimeRangeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            timestamp: dayjs('2022-02-06T04:00:00.000Z').valueOf(),
          }),
        },
        {
          transactionTimeRange24hr: {
            startTime: {
              utcHours: 1,
              utcMinutes: 30,
            },
            endTime: {
              utcHours: 4,
              utcMinutes: 0,
            },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transactions in time range for transaction date equal to start time', async () => {
    expect(
      await new TransactionTimeRangeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            timestamp: dayjs('2022-02-06T02:00:00.000Z').valueOf(),
          }),
        },
        {
          transactionTimeRange24hr: {
            startTime: {
              utcHours: 2,
              utcMinutes: 0,
            },
            endTime: {
              utcHours: 5,
              utcMinutes: 0,
            },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transactions in time range for transaction date less that the filter', async () => {
    expect(
      await new TransactionTimeRangeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            timestamp: dayjs('2022-01-05T03:00:00.000Z').valueOf(),
          }),
        },
        {
          transactionTimeRange24hr: {
            startTime: {
              utcHours: 1,
              utcMinutes: 30,
            },
            endTime: {
              utcHours: 5,
              utcMinutes: 0,
            },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transactions not in time range', async () => {
    expect(
      await new TransactionTimeRangeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            timestamp: dayjs('2022-01-05T01:00:00.000Z').valueOf(),
          }),
        },
        {
          transactionTimeRange24hr: {
            startTime: {
              utcHours: 1,
              utcMinutes: 30,
            },
            endTime: {
              utcHours: 5,
              utcMinutes: 0,
            },
          },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transactions time range not defined', async () => {
    expect(
      await new TransactionTimeRangeRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            timestamp: 1693396800,
          }),
        },
        {
          transactionTimeRange24hr: undefined,
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
})
