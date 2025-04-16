import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { NarrativeService } from '@/services/tenants/narrative-template-service'
import { PermissionsService } from '@/services/rbac'

async function migrateTenant(tenant: Tenant) {
  const mongoClient = await getMongoDbClient()
  const narrativeService = new NarrativeService(tenant.id, mongoClient)

  const narrativeTemplates = await narrativeService.getNarrativeTemplates({
    page: 1,
    pageSize: 10000,
  })

  const permissionsService = new PermissionsService(tenant.id)

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
