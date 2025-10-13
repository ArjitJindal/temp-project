import { TransactionTagsRuleFilter } from '../transaction-tags'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()
filterVariantsTest({ v8: true }, () => {
  test('Transaction tags missing', async () => {
    expect(
      await new TransactionTagsRuleFilter(
        getTestTenantId(),
        {
          transaction: getTestTransaction({
            tags: undefined,
          }),
        },
        { transactionTags: { tags: { tag1: ['value1'] } } },
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
        { transactionTags: { tags: { tag1: ['value1'] } } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transaction tags matches the filter with useAND logic', async () => {
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
        { transactionTags: { tags: { tag1: ['value1'] }, useAndLogic: true } },
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
        { transactionTags: { tags: { tag1: ['value2'] } } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction tags does not match the filter with useAND logic', async () => {
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
        { transactionTags: { tags: { tag1: ['value2'] }, useAndLogic: true } },
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
        { transactionTags: { tags: { tag1: ['value1'], tag2: ['value3'] } } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('Transaction tags not matches the filter with multiple tags for use AND logic', async () => {
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
        {
          transactionTags: {
            tags: { tag1: ['value1'], tag2: ['value3'] },
            useAndLogic: true,
          },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('Transaction tags matches the filter with multiple tags for use AND logic', async () => {
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
        {
          transactionTags: {
            tags: { tag1: ['value1'], tag2: ['value2'] },
            useAndLogic: true,
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
})
