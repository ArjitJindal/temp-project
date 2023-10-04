import { isEmpty } from 'lodash'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { Feature } from '@/@types/openapi-internal/Feature'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  getContext,
  getTestEnabledFeatures,
  updateTenantFeatures,
} from '@/core/utils/context'

// Function for finaind tenant specific feature - to be used in global systems without context like Kinesis Consumers
// For lambdas in console API or public API, use `useFeature` from context instead
export async function tenantHasFeature(
  tenantId: string,
  feature: Feature
): Promise<boolean> {
  const tenantRepository = new TenantRepository(tenantId, {
    dynamoDb: getDynamoDbClient(),
  })

  const contextFeatures = getContext()?.features

  const features = isEmpty(contextFeatures)
    ? (await tenantRepository.getTenantSettings(['features']))?.features
    : contextFeatures

  if (isEmpty(contextFeatures) && features) {
    updateTenantFeatures(features)
  }

  return (
    features?.includes(feature) ||
    getTestEnabledFeatures()?.includes(feature) ||
    false
  )
}
