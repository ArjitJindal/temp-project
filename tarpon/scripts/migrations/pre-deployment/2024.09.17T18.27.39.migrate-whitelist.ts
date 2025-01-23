import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_WHITELIST_ENTITIES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { complyAdvantageDocToEntity } from '@/services/sanctions/providers/comply-advantage-provider'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()

  const sanctionsWhiteListCollection = db.collection<SanctionsWhitelistEntity>(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
  )
  for await (const sanctionsWhitelist of sanctionsWhiteListCollection.find({
    'sanctionsEntity.doc': { $exists: true },
  })) {
    if (sanctionsWhitelist.sanctionsEntity) {
      const entity = complyAdvantageDocToEntity({
        doc: sanctionsWhitelist.sanctionsEntity as ComplyAdvantageSearchHitDoc,
      })
      await sanctionsWhiteListCollection.updateOne(
        { _id: sanctionsWhitelist._id },
        {
          $set: {
            sanctionsEntity: entity,
            screenEntity: sanctionsWhitelist.entity,
          },
        }
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
