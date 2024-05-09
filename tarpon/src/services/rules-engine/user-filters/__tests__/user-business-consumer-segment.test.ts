import { nanoid } from 'nanoid'
import { BusinessUserSegmentRuleFilter } from '../user-business-consumer-segment'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { Business } from '@/@types/openapi-internal/Business'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamoDb = getDynamoDbClient()

const TEST_BUSINESS_USER: Business = getTestBusiness({
  userId: nanoid(),
  legalEntity: {
    companyGeneralDetails: {
      userSegment: 'LIMITED',
      legalName: 'Company name Pvt Ltd',
    },
  },
})

const TEST_CONSUMER_USER = getTestUser({
  userId: nanoid(),
})

const TEST_TENANT_ID = getTestTenantId()

filterVariantsTest({ v8: true }, () => {
  test('Empty parameter', async () => {
    const filter = new BusinessUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_BUSINESS_USER,
      },
      {},
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(true)
  })

  test('User segment matches', async () => {
    const filter = new BusinessUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_BUSINESS_USER,
      },
      {
        businessUserSegments: ['LIMITED'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(true)
  })

  test('User segment does not match', async () => {
    const filter = new BusinessUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_BUSINESS_USER,
      },
      {
        businessUserSegments: ['SOLE_PROPRIETORSHIP'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(false)
  })

  test('Multiple user segments match', async () => {
    const filter = new BusinessUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_BUSINESS_USER,
      },
      {
        businessUserSegments: ['LIMITED', 'SMALL'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(true)
  })

  test('Consumer User Check', async () => {
    const filter = new BusinessUserSegmentRuleFilter(
      TEST_TENANT_ID,
      {
        user: TEST_CONSUMER_USER,
      },
      {
        businessUserSegments: ['SMALL', 'SOLE_PROPRIETORSHIP'],
      },
      dynamoDb
    )
    const result = await filter.predicate()
    expect(result).toBe(false)
  })
})
