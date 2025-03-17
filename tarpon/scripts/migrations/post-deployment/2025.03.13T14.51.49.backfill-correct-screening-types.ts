import { AnyBulkWriteOperation } from 'mongodb'
import { compact, uniq } from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { Tenant } from '@/services/accounts/repository'
import { getMongoDbClientDb, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { ComplyAdvantageMatchTypeDetails } from '@/@types/openapi-internal/ComplyAdvantageMatchTypeDetails'
import { SanctionsWhitelistEntity } from '@/@types/openapi-internal/SanctionsWhitelistEntity'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'

async function migrateTenant(tenant: Tenant) {
  const providers = getDefaultProviders()
  if (!providers.includes('comply-advantage')) {
    return
  }
  const db = await getMongoDbClientDb()
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
    match_types_details: Array<ComplyAdvantageMatchTypeDetails>
  }>([
    {
      $group: {
        _id: '$entity.id',
        match_types_details: {
          $push: '$entity.rawResponse.match_types_details',
        },
      },
    },
    {
      $project: {
        match_types_details: {
          $reduce: {
            input: '$match_types_details',
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
          { match_types_details: { $ne: null } },
          {
            $expr: {
              $gt: [
                {
                  $size: ['$match_types_details'],
                },
                0,
              ],
            },
          },
        ],
      },
    },
  ])

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
        const screeningTypes = getScreeningTypesFromMatchTypeDetails(
          hit.match_types_details
        )
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
                if (d.rawResponse?.match_types_details) {
                  return {
                    ...d,
                    sanctionSearchTypes: getScreeningTypesFromMatchTypeDetails(
                      d.rawResponse?.match_types_details
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
  match_types_details?: Array<ComplyAdvantageMatchTypeDetails>
) => {
  return compact(
    uniq(
      match_types_details?.flatMap((mt) =>
        mt.aml_types?.map((t) =>
          t.includes('media')
            ? 'ADVERSE_MEDIA'
            : t.includes('pep')
            ? 'PEP'
            : 'SANCTIONS'
        )
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
