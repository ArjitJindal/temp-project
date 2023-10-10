import { TransactionTimeRangeRuleFilter } from '../transaction-time-range'
import { TransactionTimeRangeHistoricalRuleFilter } from '../transaction-time-range-historical'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Transactions in time range', async () => {
  expect(
    await new TransactionTimeRangeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          timestamp: 1693407600,
        }),
      },
      {
        transactionTimeRange: {
          startTime: 1693403040,
          endTime: 1693411200,
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
          timestamp: 1693396800,
        }),
      },
      {
        transactionTimeRange: {
          startTime: 1693403040,
          endTime: 1693411200,
        },
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transactions not in time range', async () => {
  expect(
    await new TransactionTimeRangeRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          timestamp: 1693321200,
        }),
      },
      {
        transactionTimeRange: {
          startTime: 1693403040,
          endTime: 1693411200,
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
        transactionTimeRange: undefined,
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Historical transaction in time range', async () => {
  expect(
    await new TransactionTimeRangeHistoricalRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          timestamp: 1693321200,
        }),
      },
      {
        transactionTimeRangeHistorical: {
          startTime: 1693403040,
          endTime: 1693411200,
        },
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Historical transaction not in time range', async () => {
  expect(
    await new TransactionTimeRangeHistoricalRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          timestamp: 1693293890,
        }),
      },
      {
        transactionTimeRangeHistorical: {
          startTime: 1693403040,
          endTime: 1693411200,
        },
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Historical transaction time range not defined', async () => {
  expect(
    await new TransactionTimeRangeHistoricalRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          timestamp: 1693293890,
        }),
      },
      {
        transactionTimeRangeHistorical: undefined,
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})
