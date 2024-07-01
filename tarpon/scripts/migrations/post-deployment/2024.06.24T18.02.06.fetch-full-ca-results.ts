import { migrateAllTenants } from '../utils/tenant'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { Tenant } from '@/services/accounts'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { SanctionsService } from '@/services/sanctions'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== 'flagright') {
    return
  }
  const mongoDb = await getMongoDbClientDb()
  const sanctionsService = new SanctionsService(tenant.id)

  const collection = mongoDb.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  for await (const search of collection.find()) {
    logger.info(`Migrating search ${search._id} users`)
    const caSearchId =
      search?.response?.rawComplyAdvantageResponse?.content?.data?.id
    if (caSearchId != null) {
      await sanctionsService.refreshSearch(caSearchId)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
