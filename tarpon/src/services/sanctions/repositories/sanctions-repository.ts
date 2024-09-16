import {
  Action,
  SanctionsDataProviderName,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

export class MongoSanctionsRepository implements SanctionsRepository {
  async save(
    provider: SanctionsDataProviderName,
    entities: [Action, SanctionsEntity][],
    version: string
  ): Promise<void> {
    const client = await getMongoDbClient()
    const coll = client.db().collection(SANCTIONS_COLLECTION)

    const operations = entities.map(([action, entity]) => {
      switch (action) {
        case 'add':
          return {
            updateOne: {
              filter: { id: entity.id, version, provider },
              update: {
                $setOnInsert: {
                  ...entity,
                  provider,
                  version,
                  createdAt: Date.now(),
                },
              },
              upsert: true,
            },
          }
        case 'change':
          return {
            updateOne: {
              filter: {
                id: entity.id,
                provider,
                version,
                deletedAt: { $exists: false },
              },
              update: {
                $set: {
                  ...entity,
                  version,
                  updatedAt: Date.now(),
                },
              },
            },
          }
        case 'remove':
          return {
            updateOne: {
              filter: {
                id: entity.id,
                provider,
                version,
                deletedAt: { $exists: false },
              },
              update: {
                $set: {
                  ...entity,
                  version,
                  deletedAt: Date.now(),
                },
              },
            },
          }
        default:
          throw new Error(`Unsupported action: ${action}`)
      }
    })

    await coll.bulkWrite(operations)
  }

  async saveAssociations(
    provider: SanctionsDataProviderName,
    associations: [string, string[]][],
    version: string
  ) {
    const client = await getMongoDbClient()
    const coll = client.db().collection(SANCTIONS_COLLECTION)
    await coll
      .aggregate([
        {
          // Unwind the provided associates array into documents
          $addFields: {
            associatesArray: associations,
          },
        },
        {
          $unwind: '$associatesArray',
        },
        {
          $project: {
            id: { $arrayElemAt: ['$associatesArray', 0] },
            associateIds: { $arrayElemAt: ['$associatesArray', 1] },
            provider: 1, // Include provider from original documents
            version: 1, // Include version from original documents
          },
        },
        {
          // Lookup all associates in bulk based on associate IDs
          $lookup: {
            from: SANCTIONS_COLLECTION,
            let: { associateIds: '$associateIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$id', '$$associateIds'] },
                      { provider }, // Match on provider
                      { version }, // Match on version
                    ],
                  },
                },
              },
              {
                $project: { name: 1 }, // Only project name of the associates
              },
            ],
            as: 'associates',
          },
        },
        {
          // Match the existing documents with the associates' names
          $project: {
            _id: 0,
            id: 1,
            provider: 1, // Keep provider for matching in $merge
            version: 1, // Keep version for matching in $merge
            associates: '$associates.name', // Extract names of the associates
          },
        },
        {
          $merge: {
            into: SANCTIONS_COLLECTION,
            whenMatched: [{ $set: { associates: '$$new.associates' } }],
            whenNotMatched: 'discard',
            on: ['provider', 'id', 'version'],
          },
        },
      ])
      .toArray()
  }
}
