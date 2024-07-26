import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsSearchRepository } from '@/services/sanctions/repositories/sanctions-search-repository'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const searchRepository = new SanctionsSearchRepository(tenant.id, mongoDb)
  const hitsRepository = new SanctionsHitsRepository(tenant.id, mongoDb)
  let counter = 0
  for await (const hit of hitsRepository.iterateHits()) {
    logger.info(`Migrating hit ${hit.sanctionsHitId} (${++counter})`)
    const searchResult = await searchRepository.getSearchResult(hit.searchId)
    const hits =
      searchResult?.response?.rawComplyAdvantageResponse?.content?.data?.hits
    const sourceHit = hits?.find((x) => x.doc?.id === hit.caEntity?.id)
    if (sourceHit != null) {
      await hitsRepository.updateHitsByIds([hit.sanctionsHitId], {
        caMatchTypes: sourceHit.match_types,
        caMatchTypesDetails: sourceHit.match_types_details,
      })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
