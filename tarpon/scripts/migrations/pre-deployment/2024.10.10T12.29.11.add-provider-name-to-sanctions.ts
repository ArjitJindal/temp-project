import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { tenantHasFeature } from '@/core/utils/context'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()

  const sanctionsSearchCollection = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  const hitCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )

  const whitelistCollection = db.collection<SanctionsWhitelistEntity>(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
  )

  for (const collection of [
    sanctionsSearchCollection,
    hitCollection,
    whitelistCollection,
  ]) {
    await collection.updateMany(
      {},
      {
        $set: {
          provider: (await tenantHasFeature(tenant.id, 'DOW_JONES'))
            ? 'dowjones'
            : 'comply-advantage',
        },
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
