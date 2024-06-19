import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/all'

async function migrateTenant(tenant: Tenant) {
  const mongoClient = await getMongoDbClient()
  const hitsRepository = new SanctionsHitsRepository(tenant.id, mongoClient)
  const collection = mongoClient
    .db()
    .collection<SanctionsSearchHistory>(
      SANCTIONS_SEARCHES_COLLECTION(tenant.id)
    )

  const cursor = collection.find()
  for await (const searchHistoryElement of cursor) {
    const hits = searchHistoryElement.response?.data
    await hitsRepository.addHits(searchHistoryElement._id, hits ?? [], {})
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {}
