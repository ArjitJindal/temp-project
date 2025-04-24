import pMap from 'p-map'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { ComplyAdvantageDataProvider } from '@/services/sanctions/providers/comply-advantage-provider'
import { SanctionsSearchRepository } from '@/services/sanctions/repositories/sanctions-search-repository'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const providers = getDefaultProviders()
  if (!providers.includes(SanctionsDataProviders.COMPLY_ADVANTAGE)) {
    return
  }
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const sanctionsSearchesCollection = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenantId)
  )
  const sanctionsSearches = sanctionsSearchesCollection.find({
    provider: SanctionsDataProviders.COMPLY_ADVANTAGE,
    'response.data': { $exists: false },
    'response.hitsCount': { $gt: 0 },
  })
  const provider = await ComplyAdvantageDataProvider.build(tenantId)
  const sanctionsSearchRepository = new SanctionsSearchRepository(
    tenantId,
    mongoDb
  )
  await processCursorInBatch(sanctionsSearches, async (searches) => {
    await pMap(
      searches,
      async (search) => {
        const providerSearchId = search.response?.providerSearchId
        if (!providerSearchId) {
          return
        }
        const result =
          await sanctionsSearchRepository.getSearchResultByProviderSearchId(
            SanctionsDataProviders.COMPLY_ADVANTAGE,
            providerSearchId
          )
        if (!result) {
          return false
        }
        const response = await provider.getSearch(providerSearchId)
        const parsedResponse = {
          hitsCount: response.data?.length ?? 0,
          searchId: result._id,
          providerSearchId: response.providerSearchId,
          createdAt: Date.now(),
          data: response.data ?? [],
        }
        await sanctionsSearchRepository.saveSearchResult({
          provider: SanctionsDataProviders.COMPLY_ADVANTAGE,
          request: result.request,
          response: parsedResponse,
          createdAt: result.createdAt,
          updatedAt: Date.now(),
          hitContext: result.hitContext,
          providerConfigHash: result.providerConfigHash,
          requestHash: result.requestHash,
        })
      },
      { concurrency: 50 }
    )
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
