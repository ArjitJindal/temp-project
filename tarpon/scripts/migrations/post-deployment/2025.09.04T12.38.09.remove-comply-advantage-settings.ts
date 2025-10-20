/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const tenantRepository = new TenantRepository(tenant.id, {
    dynamoDb,
    mongoDb,
  })
  const { sanctions } = await tenantRepository.getTenantSettings(['sanctions'])
  if (!sanctions) {
    return
  }
  if (sanctions?.marketType) {
    delete sanctions.marketType
  }
  if (sanctions.customSearchProfileId) {
    delete sanctions.customSearchProfileId
  }
  if (sanctions.customInitialSearchProfileId) {
    delete sanctions.customInitialSearchProfileId
  }
  if (sanctions?.providerScreeningTypes) {
    sanctions.providerScreeningTypes = sanctions.providerScreeningTypes?.filter(
      (type) => {
        if (type.provider === 'comply-advantage') {
          return false
        }
        return true
      }
    )
  }
  await tenantRepository.createOrUpdateTenantSettings({ sanctions })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
