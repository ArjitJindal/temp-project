import { UserKycStatusRuleFilter } from '../user-kyc-status'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { filterVariantsTest } from '@/test-utils/filter-test-utils'

const dynamoDb = getDynamoDbClient()

const TEST_CONSUMER_USER_WITH_SUCCESSFUL_KYC_STATUS = getTestUser({
  userId: '1',
  kycStatusDetails: {
    status: 'SUCCESSFUL',
  },
})

const TEST_CONSUMER_USER_WITH_FAILED_KYC_STATUS = getTestUser({
  userId: '2',
  kycStatusDetails: {
    status: 'FAILED',
  },
})

const TEST_CONSUMER_USER_WITH_NO_KYC_STATUS = getTestUser({
  userId: '3',
})

const TEST_CONSUMER_USER_WITH_IN_PROGRESS_KYC_STATUS = getTestUser({
  userId: '4',
  kycStatusDetails: {
    status: 'IN_PROGRESS',
  },
})

const TEST_BUSINESS_USER_WITH_SUCCESSFUL_KYC_STATUS = getTestBusiness({
  userId: '5',
  kycStatusDetails: {
    status: 'SUCCESSFUL',
  },
})

const TEST_BUSINESS_USER_WITH_NO_KYC_STATUS = getTestBusiness({
  userId: '6',
})

const tenantId = getTestTenantId()
filterVariantsTest({ v8: true }, () => {
  describe('UserKycStatusRuleFilter', () => {
    test('Empty parameter', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_SUCCESSFUL_KYC_STATUS,
          },
          {},
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('KYC status match the filter', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_SUCCESSFUL_KYC_STATUS,
          },
          { kycStatus: ['SUCCESSFUL'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('User KYC status does not match the filter', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_SUCCESSFUL_KYC_STATUS,
          },
          { kycStatus: ['MANUAL_REVIEW'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User KYC status match the filter for Business user', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_BUSINESS_USER_WITH_SUCCESSFUL_KYC_STATUS,
          },
          { kycStatus: ['SUCCESSFUL'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('User KYC status match the filter', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_FAILED_KYC_STATUS,
          },
          { kycStatus: ['FAILED'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })

    test('User KYC status for business user does not match the filter', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_BUSINESS_USER_WITH_SUCCESSFUL_KYC_STATUS,
          },
          { kycStatus: ['FAILED'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User KYC status for business user does not match the filter - KYC status undefined', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_BUSINESS_USER_WITH_NO_KYC_STATUS,
          },
          { kycStatus: ['SUCCESSFUL'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User KYC status for consumer user does not match the filter - KYC status undefined', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_NO_KYC_STATUS,
          },
          { kycStatus: ['FAILED'] },
          dynamoDb
        ).predicate()
      ).toBe(false)
    })

    test('User KYC status match the filter', async () => {
      expect(
        await new UserKycStatusRuleFilter(
          tenantId,
          {
            user: TEST_CONSUMER_USER_WITH_IN_PROGRESS_KYC_STATUS,
          },
          { kycStatus: ['FAILED', 'IN_PROGRESS'] },
          dynamoDb
        ).predicate()
      ).toBe(true)
    })
  })
})
