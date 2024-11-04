import { Filter } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'

// const DRY_RUN = true
const DRY_RUN = false

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const hitsCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  const searchesCollection = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )

  let counter = 0
  let hitsCounter = 0
  const filter: Filter<SanctionsSearchHistory> = {
    provider: 'dowjones',
    'response.data': { $exists: true, $not: { $size: 0 } },
  }
  const totalCount = await searchesCollection.countDocuments(filter)
  for await (const search of searchesCollection.find(filter)) {
    console.log(
      `Handled ${counter}/${totalCount} searches, ${hitsCounter} hits`
    )
    const hits = await hitsCollection
      .find({
        $and: [
          {
            searchId: search.response?.searchId,
          },
          {
            $or: [
              { 'entity.matchTypeDetails': { $exists: false } },
              { 'entity.matchTypeDetails': { $size: 0 } },
            ],
          },
        ],
      })
      .toArray()

    for (const hit of hits) {
      if (!DRY_RUN) {
        await hitsCollection.updateOne(
          {
            sanctionsHitId: hit.sanctionsHitId,
          },
          {
            $set: {
              'entity.matchTypeDetails': [
                DowJonesProvider.deriveMatchingDetails(
                  search.request,
                  hit.entity
                ),
              ],
            },
          }
        )
      }
      hitsCounter++
    }
    counter++
  }
  console.log(`Handled ${counter} searches`)
  console.log(`Updated ${hitsCounter} hits`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}

if (require.main === module) {
  migrateTenant({
    id: 'flagright',
    name: 'name',
    orgId: 'orgId',
    apiAudience: 'apiAudience',
    region: 'region',
    isProductionAccessDisabled: true,
  }).then(
    () => {
      console.log('Done')
      process.exit(0)
    },
    (e) => {
      console.error(e)
      process.exit(1)
    }
  )
}
