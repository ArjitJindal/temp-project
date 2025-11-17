import { UserTagsRuleFilter } from '../user-tags'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamodb = getDynamoDbClient()
filterVariantsTest({ v8: true }, () => {
  test('User tags missing', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            tags: undefined,
          }),
        },
        { userTags: { tags: { tag1: ['value1'] } } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('User tags matches the filter', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            tags: [
              {
                key: 'tag1',
                value: 'value1',
              },
            ],
          }),
        },
        { userTags: { tags: { tag1: ['value1'] } } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('User tags matches the filter with useAND logic', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            tags: [
              {
                key: 'tag1',
                value: 'value1',
              },
            ],
          }),
        },
        { userTags: { tags: { tag1: ['value1'] }, useAndLogic: true } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('User tags does not match the filter', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            tags: [
              {
                key: 'tag1',
                value: 'value1',
              },
            ],
          }),
        },
        { userTags: { tags: { tag1: ['value2'] } } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('User tags does not match the filter with useAND logic', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
            tags: [
              {
                key: 'tag1',
                value: 'value1',
              },
            ],
          }),
        },
        { userTags: { tags: { tag1: ['value2'] }, useAndLogic: true } },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('User tags matches the filter with multiple tags', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
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
        { userTags: { tags: { tag1: ['value1'], tag2: ['value3'] } } },
        dynamodb
      ).predicate()
    ).toBe(true)
  })

  test('User tags not matches the filter with multiple tags for use AND logic', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
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
          userTags: {
            tags: { tag1: ['value1'], tag2: ['value3'] },
            useAndLogic: true,
          },
        },
        dynamodb
      ).predicate()
    ).toBe(false)
  })

  test('User tags matches the filter with multiple tags for use AND logic', async () => {
    expect(
      await new UserTagsRuleFilter(
        getTestTenantId(),
        {
          user: getTestUser({
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
          userTags: {
            tags: { tag1: ['value1'], tag2: ['value2'] },
            useAndLogic: true,
          },
        },
        dynamodb
      ).predicate()
    ).toBe(true)
  })
})
