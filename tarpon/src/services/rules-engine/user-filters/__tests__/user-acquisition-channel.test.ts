import { UserAcquisitionChannelRuleFilter } from '../user-acquisition-channel'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamoDb = getDynamoDbClient()

const TEST_CONSUMER_USER_WITH_PAID_ACQUISITION = getTestUser({
  userId: '1',
  acquisitionChannel: 'PAID',
})

const TEST_CONSUMER_USER_WITH_OFFLINE_ACQUISITION = getTestUser({
  userId: '2',
  acquisitionChannel: 'OFFLINE',
})

const TEST_BUSINESS_USER_WITH_PAID_ACQUISITION = getTestBusiness({
  userId: '3',
  acquisitionChannel: 'PAID',
})

const TEST_USER_WITH_NO_ACQUISITION = getTestUser({
  userId: '4',
})

const TEST_BUSINESS_USER_WITH_NO_ACQUISITION = getTestBusiness({
  userId: '5',
})

const tenantId = getTestTenantId()
filterVariantsTest({ v8: true }, () => {
  test('Empty parameter', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_CONSUMER_USER_WITH_PAID_ACQUISITION,
        },
        {},
        dynamoDb
      ).predicate()
    ).toBe(true)
  })

  test('Acquisition channel match the filter', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_CONSUMER_USER_WITH_PAID_ACQUISITION,
        },
        { acquisitionChannels: ['PAID'] },
        dynamoDb
      ).predicate()
    ).toBe(true)
  })

  test('Acquisition channel doesnot match the filter', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_CONSUMER_USER_WITH_PAID_ACQUISITION,
        },
        { acquisitionChannels: ['OFFLINE'] },
        dynamoDb
      ).predicate()
    ).toBe(false)
  })

  test('Acquisition channel match the filter - offline', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_CONSUMER_USER_WITH_OFFLINE_ACQUISITION,
        },
        { acquisitionChannels: ['OFFLINE'] },
        dynamoDb
      ).predicate()
    ).toBe(true)
  })

  test('Acquisition channel business user match the filter', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_BUSINESS_USER_WITH_PAID_ACQUISITION,
        },
        { acquisitionChannels: ['PAID'] },
        dynamoDb
      ).predicate()
    ).toBe(true)
  })

  test('Acquisition channel business user doesnot match the filter', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_BUSINESS_USER_WITH_PAID_ACQUISITION,
        },
        { acquisitionChannels: ['OFFLINE'] },
        dynamoDb
      ).predicate()
    ).toBe(false)
  })

  test('Acquisition channel business user doesnot match the filter - no acquisition channel', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_BUSINESS_USER_WITH_NO_ACQUISITION,
        },
        { acquisitionChannels: ['OFFLINE'] },
        dynamoDb
      ).predicate()
    ).toBe(false)
  })

  test('Acquisition channel consumer user doesnot match the filter - no acquisition channel', async () => {
    expect(
      await new UserAcquisitionChannelRuleFilter(
        tenantId,
        {
          user: TEST_USER_WITH_NO_ACQUISITION,
        },
        { acquisitionChannels: ['OFFLINE'] },
        dynamoDb
      ).predicate()
    ).toBe(false)
  })
})
