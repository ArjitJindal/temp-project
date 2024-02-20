import { TRANSACTION_TIME } from '../transaction-time'
import dayjs from '@/utils/dayjs'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

test('transaction time x', async () => {
  const transaction = getTestTransaction({
    timestamp: dayjs('2022-01-06T03:10:00.000Z').valueOf(),
  })
  const time = await TRANSACTION_TIME.load(transaction, {
    tenantId: 'test',
    dynamoDb: getDynamoDbClient(),
  })

  expect(time).toBe(11400)
})

test('transaction time y', async () => {
  const transaction = getTestTransaction({
    timestamp: dayjs('2022-01-06T18:40:00.000Z').valueOf(),
  })
  const time = await TRANSACTION_TIME.load(transaction, {
    tenantId: 'test',
    dynamoDb: getDynamoDbClient(),
  })

  expect(time).toBe(67200)
})
