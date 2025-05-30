import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { NarrativeService } from '@/services/tenants/narrative-template-service'
import { PermissionsService } from '@/services/rbac'
import { getClickhouseCredentials } from '@/utils/clickhouse/utils'

async function migrateTenant(tenant: Tenant) {
  const mongoClient = await getMongoDbClient()
  const clickhouseConfig = await getClickhouseCredentials(tenant.id)
  const narrativeService = new NarrativeService(
    tenant.id,
    mongoClient,
    clickhouseConfig
  )

  const narrativeTemplates = await narrativeService.getNarrativeTemplates({
    page: 1,
    pageSize: 10000,
  })

  const permissionsService = new PermissionsService(tenant.id, mongoClient)

  for (const template of narrativeTemplates.items) {
    await permissionsService.insertDynamicPermission('NARRATIVE_TEMPLATES', {
      id: template.id,
      name: template.name,
    })
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
