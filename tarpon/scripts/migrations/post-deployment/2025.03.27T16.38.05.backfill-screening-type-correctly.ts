import { AnyBulkWriteOperation } from 'mongodb'
import { compact, uniq } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClientDb, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { getDefaultProviders } from '@/services/sanctions/utils'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const providers = getDefaultProviders()
  if (
    !providers.includes('comply-advantage') &&
    !providers.includes('acuris')
  ) {
    // Acuris because some of the tenants have moved to Acuris
    return
  }
  const hitsCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  const whiteListCollection = db.collection<SanctionsWhitelistEntity>(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
  )
  await Promise.all([
    whiteListCollection.createIndex({
      'sanctionsEntity.id': 1,
    }),
    hitsCollection.createIndex({
      'entity.id': 1,
    }),
  ])

  const hits = hitsCollection.aggregate<{
    _id: string
    types: Array<string>
  }>([
    {
      $match: {
        provider: 'comply-advantage',
      },
    },
    {
      $group: {
        _id: '$entity.id',
        types: {
          $push: '$entity.rawResponse.doc.types',
        },
      },
    },
    {
      $project: {
        types: {
          $reduce: {
            input: '$types',
            initialValue: [],
            in: {
              $concatArrays: ['$$value', '$$this'],
            },
          },
        },
      },
    },
    {
      $match: {
        $and: [
          {
            types: {
              $ne: null,
            },
          },
          {
            $expr: {
              $gt: [
                {
                  $size: ['$types'],
                },
                0,
              ],
            },
          },
        ],
      },
    },
  ])
  console.log('Finished aggregating hits data')
  await processCursorInBatch(
    hits,
    async (sanctionsHits) => {
      let bulkUpdates: {
        hitsWrite: AnyBulkWriteOperation<SanctionsHit>[]
        whiteListWrite: AnyBulkWriteOperation<SanctionsWhitelistEntity>[]
      } = {
        hitsWrite: [],
        whiteListWrite: [],
      }
      sanctionsHits.map((hit) => {
        const screeningTypes = getScreeningTypesFromMatchTypeDetails(hit.types)
        bulkUpdates.hitsWrite.push({
          updateMany: {
            filter: {
              'entity.id': hit._id,
            },
            update: {
              $set: {
                'entity.sanctionSearchTypes': screeningTypes,
              },
            },
            upsert: false,
          },
        })
        bulkUpdates.whiteListWrite.push({
          updateMany: {
            filter: {
              'sanctionsEntity.id': hit._id,
            },
            update: {
              $set: {
                'sanctionsEntity.sanctionSearchTypes': screeningTypes,
              },
            },
            upsert: false,
          },
        })
      })
      await Promise.all([
        hitsCollection.bulkWrite(bulkUpdates.hitsWrite),
        whiteListCollection.bulkWrite(bulkUpdates.whiteListWrite),
      ])
      bulkUpdates = {
        hitsWrite: [],
        whiteListWrite: [],
      }
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 1000,
    }
  )
  const sanctionsSearchesCollection = db.collection<SanctionsSearchHistory>(
    SANCTIONS_SEARCHES_COLLECTION(tenant.id)
  )
  const searchesCursor = sanctionsSearchesCollection.find({
    $and: [
      { 'response.data': { $ne: null } },
      { 'response.data': { $ne: [] } },
      { provider: 'comply-advantage' },
    ],
  })
  await processCursorInBatch(searchesCursor, async (searches) => {
    let sanctionsSearchesBulkUpdates: AnyBulkWriteOperation<SanctionsSearchHistory>[] =
      []
    searches.map((search) => {
      sanctionsSearchesBulkUpdates.push({
        updateOne: {
          filter: {
            _id: search._id as any,
          },
          update: {
            $set: {
              'response.data': search.response?.data?.map((d) => {
                if (d.rawResponse?.doc?.types) {
                  return {
                    ...d,
                    sanctionSearchTypes: getScreeningTypesFromMatchTypeDetails(
                      d.rawResponse.doc.types
                    ),
                  }
                }
                return d
              }),
            },
          },
          upsert: false,
        },
      })
    })
    await sanctionsSearchesCollection.bulkWrite(sanctionsSearchesBulkUpdates)
    sanctionsSearchesBulkUpdates = []
  })
}

const getScreeningTypesFromMatchTypeDetails = (
  types?: Array<string>
): SanctionsSearchType[] => {
  return compact(
    uniq(
      types?.map((t) =>
        t.includes('media')
          ? 'ADVERSE_MEDIA'
          : t.includes('pep')
          ? 'PEP'
          : t.includes('warning')
          ? 'WARNINGS'
          : 'SANCTIONS'
      )
    )
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
