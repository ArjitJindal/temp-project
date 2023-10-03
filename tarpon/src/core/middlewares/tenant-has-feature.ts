import { logger } from '../logger'
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
  logger.info('Tenant Id', tenantId)
  const context = getContext()
  logger.info('context', context)
  const contextFeatures = context?.features
  logger.info('contextFeatures', contextFeatures)
  const featuresExists = contextFeatures?.length
  logger.info('featuresExists', featuresExists)
  const features = contextFeatures
  logger.info('features', features)
  if (!featuresExists || tenantId !== context?.tenantId) {
    const tenantFeatures = await tenantRepository.getTenantSettings([
      'features',
    ])
    logger.info('tenantFeatures', tenantFeatures)
    if (tenantFeatures?.features) {
      updateTenantFeatures(tenantFeatures.features)
    }
  }

  return (
    features?.includes(feature) ||
    getTestEnabledFeatures()?.includes(feature) ||
    false
  )
}
