import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { complyAdvantageDocToEntity } from '@/services/sanctions/providers/comply-advantage-provider'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { ComplyAdvantageSearchHit } from '@/@types/openapi-internal/ComplyAdvantageSearchHit'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()

  const sanctionsSearchHistory = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )

  const sanctionsHits = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )

  for await (const searchHistory of sanctionsSearchHistory.find({})) {
    if (
      searchHistory.response?.data &&
      searchHistory.response?.data.length > 0 &&
      // eslint-disable-next-line no-prototype-builtins
      searchHistory.response?.data[0].hasOwnProperty('doc')
    ) {
      const data = searchHistory.response?.data.map((hit) => {
        return complyAdvantageDocToEntity(
          hit as unknown as ComplyAdvantageSearchHit
        )
      })
      await sanctionsSearchHistory.updateOne(
        { _id: searchHistory._id },
        {
          $set: {
            'response.data': data,
            'response.originalData': searchHistory.response?.data,
          },
        }
      )
    }
  }
  for await (const sanctionsHit of sanctionsHits.find({})) {
    if (
      sanctionsHit.entity &&
      // eslint-disable-next-line no-prototype-builtins
      sanctionsHit.entity.hasOwnProperty('doc')
    ) {
      const newEntity = complyAdvantageDocToEntity(
        sanctionsHit.entity as unknown as ComplyAdvantageSearchHit
      )
      await sanctionsHits.updateOne(
        { _id: sanctionsHit._id },
        {
          $set: {
            entity: newEntity,
            originEntity: sanctionsHit.entity,
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
