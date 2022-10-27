import { nanoid } from 'nanoid'
import { Feature } from '@/@types/openapi-internal/Feature'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

// NOTE: Use this for getting a unique tenant ID in each test suite, then we can support
// running tests in parallel without interferring each other.
export function getTestTenantId() {
  return `TEST-TENANT-${nanoid()}`
}

export async function setFeatureFlags(tenantId: string, features: Feature[]) {
  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb: getDynamoDbClient(),
  })
  await tenantRepository.createOrUpdateTenantSettings({ features })
}

export async function clearFeatureFlags(tenantId: string) {
  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb: getDynamoDbClient(),
  })
  await tenantRepository.createOrUpdateTenantSettings({ features: [] })
}
