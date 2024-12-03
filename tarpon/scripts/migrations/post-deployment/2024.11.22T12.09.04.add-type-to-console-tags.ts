import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { logger } from '@/core/logger'
import { ConsoleTagTypeEnum } from '@/@types/openapi-internal/ConsoleTag'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  const tenantSettings = await tenantRepository.getTenantSettings()
  const { consoleTags } = tenantSettings
  if (!consoleTags) {
    return
  }
  const updatedConsoleTags = consoleTags.map((tag) => {
    return {
      ...tag,
      type: 'STRING' as ConsoleTagTypeEnum,
    }
  })
  await tenantRepository.createOrUpdateTenantSettings({
    consoleTags: updatedConsoleTags,
  })
  logger.info(`Updated console tags for tenant ${tenant.id}`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
