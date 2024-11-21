import { migrateAllTenants } from '../utils/tenant'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { Tenant } from '@/services/accounts'
import { envIs } from '@/utils/env'
import { getMongoDbClientDb, syncIndexes } from '@/utils/mongodb-utils'
import {
  getMongoDbIndexDefinitions,
  SANCTIONS_COLLECTION,
  SANCTIONS_SEARCH_INDEX,
} from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  if (envIs('prod') && tenant.id === 'pnb') {
    const db = await getMongoDbClientDb()
    const collectionName = SANCTIONS_COLLECTION(tenant.id)
    const sanctionsCollection = await db.createCollection(collectionName)

    const repo = new MongoSanctionsRepository(tenant.id)
    const dowJonesFetcher = await DowJonesProvider.build(tenant.id)
    const version = Date.now().toString()
    await dowJonesFetcher.fullLoad(repo, version)

    const indexes = getMongoDbIndexDefinitions(tenant.id)[
      collectionName
    ].getIndexes()
    await Promise.all([
      syncIndexes(sanctionsCollection, indexes),
      sanctionsCollection.createSearchIndex(SANCTIONS_SEARCH_INDEX),
    ])
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
