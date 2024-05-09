import { nanoid } from 'nanoid'
import { ConsumerUserSegmentRuleFilter } from '../user-consumer-segment'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamoDb = getDynamoDbClient()

const TEST_CONSUMER_USER = getTestUser({
  userId: nanoid(),
  userSegment: 'PROFESSIONAL', // PROFESSIONAL | RETAIL
})

const TEST_BUSINESS_USER = getTestBusiness({
  userId: nanoid(),
})

const TEST_TENANT_ID = getTestTenantId()
filterVariantsTest({ v8: true }, () => {
  test('Empty parameter', async () => {
    const filter = new ConsumerUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_CONSUMER_USER,
      },
      {},
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(true)
  })

  test('User segment matches', async () => {
    const filter = new ConsumerUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_CONSUMER_USER,
      },
      {
        consumerUserSegments: ['PROFESSIONAL'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(true)
  })

  test('User segment does not match', async () => {
    const filter = new ConsumerUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_CONSUMER_USER,
      },
      {
        consumerUserSegments: ['RETAIL'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(false)
  })

  test('Multiple user segments match', async () => {
    const filter = new ConsumerUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_CONSUMER_USER,
      },
      {
        consumerUserSegments: ['PROFESSIONAL', 'RETAIL'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(true)
  })

  test('Business User Check', async () => {
    const filter = new ConsumerUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_BUSINESS_USER,
      },
      {
        consumerUserSegments: ['PROFESSIONAL', 'RETAIL'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(false)
  })
})
