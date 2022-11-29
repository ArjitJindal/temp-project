import { TransactionTimeWindowRuleFilter } from '../transaction-time-window'
import dayjs from '@/utils/dayjs'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Transaction timestamp within the time window', async () => {
  expect(
    await new TransactionTimeWindowRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          timestamp: dayjs('2022-01-01T06:00:00.000Z').valueOf(),
        }),
      },
      {
        transactionTimeWindow: {
          from: '00:00:00+00:00',
          to: '12:00:00+00:00',
        },
      },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Transaction timestamp not within the time window', async () => {
  expect(
    await new TransactionTimeWindowRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          timestamp: dayjs('2022-01-01T18:00:00.000Z').valueOf(),
        }),
      },
      {
        transactionTimeWindow: {
          from: '00:00:00+00:00',
          to: '12:00:00+00:00',
        },
      },
      dynamodb
    ).predicate()
  ).toBe(false)
})
