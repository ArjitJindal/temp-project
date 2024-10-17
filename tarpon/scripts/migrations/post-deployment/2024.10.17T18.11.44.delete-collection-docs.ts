import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import {
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
  SANCTIONS_SCREENING_DETAILS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  //deleting all the records from pnb-uat-sanctions-screening-details and the searches collections, as these were false searches, which did not returned anything because of missing index,
  //So when we run screening rules tomorrow these searches should not be used rather it should query db again
  if (tenant.id === 'pnb-uat') {
    const db = await getMongoDbClientDb()
    const screeningDetailsCollection = db.collection(
      SANCTIONS_SCREENING_DETAILS_COLLECTION(tenant.id)
    )
    await screeningDetailsCollection.deleteMany({})
    const searchCollection = db.collection(
      SANCTIONS_SEARCHES_COLLECTION(tenant.id)
    )
    await searchCollection.deleteMany({})
    const providerSearchCollection = db.collection(
      SANCTIONS_PROVIDER_SEARCHES_COLLECTION(tenant.id)
    )
    await providerSearchCollection.deleteMany({})
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
