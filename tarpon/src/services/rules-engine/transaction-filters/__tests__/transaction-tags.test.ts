import { TransactionTagsRuleFilter } from '../transaction-tags'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'

const dynamodb = getDynamoDbClient()

test('Transaction tags missing', async () => {
  expect(
    await new TransactionTagsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          tags: undefined,
        }),
      },
      { transactionTags: { tag1: 'value1' } },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction tags matches the filter', async () => {
  expect(
    await new TransactionTagsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          tags: [
            {
              key: 'tag1',
              value: 'value1',
            },
          ],
        }),
      },
      { transactionTags: { tag1: 'value1' } },
      dynamodb
    ).predicate()
  ).toBe(true)
})

test('Transaction tags does not match the filter', async () => {
  expect(
    await new TransactionTagsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          tags: [
            {
              key: 'tag1',
              value: 'value1',
            },
          ],
        }),
      },
      { transactionTags: { tag1: 'value2' } },
      dynamodb
    ).predicate()
  ).toBe(false)
})

test('Transaction tags matches the filter with multiple tags', async () => {
  expect(
    await new TransactionTagsRuleFilter(
      getTestTenantId(),
      {
        transaction: getTestTransaction({
          tags: [
            {
              key: 'tag1',
              value: 'value1',
            },
            {
              key: 'tag2',
              value: 'value2',
            },
          ],
        }),
      },
      { transactionTags: { tag1: 'value1', tag2: 'value3' } },
      dynamodb
    ).predicate()
  ).toBe(true)
})
