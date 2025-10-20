import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { NARRATIVE_TEMPLATE_COLLECTION } from '@/utils/mongo-table-names'
import { NarrativeRepository } from '@/services/tenants/repositories/narrative-template-repository'
import { getClickhouseCredentials } from '@/utils/clickhouse/client'
import { NarrativeTemplate } from '@/@types/openapi-internal/NarrativeTemplate'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const narrativeTemplates = await mongoDb
    .db()
    .collection<NarrativeTemplate>(NARRATIVE_TEMPLATE_COLLECTION(tenant.id))
    .find({ tenantId: tenant.id })
    .toArray()

  const narrativeRepository = new NarrativeRepository(
    tenant.id,
    mongoDb,
    await getClickhouseCredentials(tenant.id)
  )

  for (const narrativeTemplate of narrativeTemplates) {
    await narrativeRepository.createNarrativeTemplateClickhouse(
      narrativeTemplate
    )
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
