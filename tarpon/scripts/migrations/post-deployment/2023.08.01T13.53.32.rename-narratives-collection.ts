import { migrateAllTenants } from '../utils/tenant'
import {
  NARRATIVE_TEMPLATE_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'

async function migrateTenant(
  tenant: Tenant,
  _auth0Domain: string,
  revert = false
) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  if (revert) {
    try {
      await db
        .collection(NARRATIVE_TEMPLATE_COLLECTION(tenant.id))
        .rename(`${tenant.id}-narratives`)
    } catch (e) {
      // The source collection doesn't exist, ignore.
    }
  } else {
    try {
      await db
        .collection(`${tenant.id}-narratives`)
        .rename(NARRATIVE_TEMPLATE_COLLECTION(tenant.id))
    } catch (e) {
      // The source collection doesn't exist, ignore.
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  await migrateAllTenants((tenant, auth0Domain) =>
    migrateTenant(tenant, auth0Domain, true)
  )
}
