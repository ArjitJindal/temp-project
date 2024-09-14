import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { complyAdvantageDocToEntity } from '@/services/sanctions/providers/comply-advantage-provider'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const sanctionsHitCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  const sanctionsWhiteListCollection = db.collection<SanctionsWhitelistEntity>(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
  )

  for await (const sanctionsHit of sanctionsHitCollection.find({})) {
    if (sanctionsHit.caEntity) {
      const entity = complyAdvantageDocToEntity({
        doc: sanctionsHit.caEntity,
        match_types_details: sanctionsHit.caMatchTypesDetails,
        match_types: sanctionsHit.caMatchTypes,
      })
      await sanctionsHitCollection.updateOne(
        { _id: sanctionsHit._id },
        { $set: { entity: entity } }
      )
    }
  }
  for await (const sanctionsWhitelist of sanctionsWhiteListCollection.find(
    {}
  )) {
    if (sanctionsWhitelist.caEntity) {
      const entity = complyAdvantageDocToEntity({
        doc: sanctionsWhitelist.caEntity,
      })
      await sanctionsHitCollection.updateOne(
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
