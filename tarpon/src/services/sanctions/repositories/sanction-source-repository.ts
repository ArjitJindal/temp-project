import { v4 as uuidv4 } from 'uuid'
import {
  UpdateOneModel,
  DeleteOneModel,
  Document,
  UpdateFilter,
  MongoClient,
} from 'mongodb'
import {
  Action,
  SanctionsSourceRepository,
} from '@/services/sanctions/providers/types'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { SourceDocument } from '@/@types/openapi-internal/SourceDocument'
import { SanctionsSourceType } from '@/@types/openapi-internal/SanctionsSourceType'
import { SANCTIONS_SOURCE_DOCUMENTS_COLLECTION } from '@/utils/mongodb-definitions'

interface SourceDocumentWithEntityIds extends Document {
  entityIds?: string[]
}

export class MongoSanctionSourcesRepository
  implements SanctionsSourceRepository
{
  mongoClient: MongoClient
  collectionName: string

  constructor(mongoClient: MongoClient) {
    this.collectionName = SANCTIONS_SOURCE_DOCUMENTS_COLLECTION()
    this.mongoClient = mongoClient
  }

  async save(
    provider: SanctionsDataProviderName,
    documents: [Action, SourceDocument][],
    version: string
  ): Promise<void> {
    const coll = this.mongoClient
      .db()
      .collection<SourceDocumentWithEntityIds>(this.collectionName)

    const operations = documents.map(([action, document]) => {
      // Create a deterministic ID based on the source properties
      const id = uuidv4()

      switch (action) {
        case 'add': {
          const update: UpdateFilter<SourceDocumentWithEntityIds> = {
            $setOnInsert: {
              id,
              createdAt: Date.now(),
            },
            $set: {
              provider,
              version,
              updatedAt: Date.now(),
              ...(document.displayName && {
                displayName: document.displayName,
              }),
            },
          }
          if (document.entityIds && document.entityIds.length > 0) {
            ;(update as any).$addToSet = {
              entityIds: {
                $each: document.entityIds,
              },
            }
          }
          const updateOne: UpdateOneModel<SourceDocumentWithEntityIds> = {
            filter: {
              sourceName: document.sourceName,
              sourceCountry: document.sourceCountry,
              provider,
              entityType: document.entityType,
              sourceType: document.sourceType,
            },
            update,
            upsert: true,
          }
          return { updateOne }
        }
        case 'chg': {
          const update: UpdateFilter<SourceDocumentWithEntityIds> = {
            $set: {
              ...document,
              version,
              updatedAt: Date.now(),
            },
          }
          const updateOne: UpdateOneModel<SourceDocumentWithEntityIds> = {
            filter: {
              id,
              provider,
              entityType: document.entityType,
              sourceType: document.sourceType,
            },
            update,
          }
          return { updateOne }
        }
        case 'del': {
          const deleteOne: DeleteOneModel<SourceDocumentWithEntityIds> = {
            filter: {
              id,
              provider,
            },
          }
          return { deleteOne }
        }
        default:
          throw new Error(`Unsupported action: ${action}`)
      }
    })

    if (operations.length > 0) {
      await coll.bulkWrite(operations)
    }
  }

  async getSanctionsSources(
    filterSourceType?: SanctionsSourceType,
    filterSourceIds?: string[],
    unique?: boolean,
    searchTerm?: string,
    projection?: Document
  ): Promise<(SourceDocument & { entityCount: number })[]> {
    const collection = this.mongoClient
      .db()
      .collection<SourceDocument>(this.collectionName)
    const matchStage: any = {}
    if (filterSourceType) {
      matchStage.sourceType = filterSourceType
    }
    if (filterSourceIds && filterSourceIds.length > 0) {
      matchStage.id = { $in: filterSourceIds }
    }
    if (searchTerm) {
      const sanitizedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '')
      matchStage.$or = [
        { sourceName: { $regex: sanitizedSearchTerm, $options: 'i' } },
        { sourceCountry: { $regex: sanitizedSearchTerm, $options: 'i' } },
      ]
    }

    const pipeline: any[] =
      Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []

    if (unique) {
      pipeline.push({
        $group: {
          _id: '$sourceName',
          id: { $first: '$id' },
          sourceName: { $first: '$sourceName' },
          sourceCountry: { $first: '$sourceCountry' },
          displayName: { $first: '$displayName' },
          sourceType: { $first: '$sourceType' },
          entityType: { $first: '$entityType' },
          entityCount: {
            $sum: {
              $size: {
                $ifNull: ['$entityIds', []],
              },
            },
          },
        },
      })
      pipeline.push({
        $project: {
          _id: 0,
          id: 1,
          sourceName: 1,
          sourceCountry: 1,
          displayName: 1,
          sourceType: 1,
          entityType: 1,
          entityCount: 1,
        },
      })
    }

    // Add sorting based on filterSourceType (same for both unique and non-unique cases)
    if (
      filterSourceType === 'REGULATORY_ENFORCEMENT_LIST' ||
      filterSourceType === 'SANCTIONS'
    ) {
      pipeline.push({ $sort: { sourceCountry: 1 } })
    } else if (filterSourceType === 'PEP') {
      pipeline.push({
        $addFields: {
          sortOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$sourceName', 'PEP Tier 1'] }, then: 1 },
                { case: { $eq: ['$sourceName', 'PEP Tier 2'] }, then: 2 },
                { case: { $eq: ['$sourceName', 'PEP Tier 3'] }, then: 3 },
                {
                  case: { $eq: ['$sourceName', 'PEP by Association'] },
                  then: 4,
                },
              ],
              default: 5,
            },
          },
        },
      })
      pipeline.push({ $sort: { sortOrder: 1 } })
    }

    if (!unique && projection) {
      pipeline.push({ $project: projection })
    }

    const sources = await collection.aggregate(pipeline).toArray()
    return sources as (SourceDocument & { entityCount: number })[]
  }
}
