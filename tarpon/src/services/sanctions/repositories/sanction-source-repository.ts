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

interface SourceDocumentWithEntityIds extends Document {
  entityIds?: string[]
}

export class MongoSanctionSourcesRepository
  implements SanctionsSourceRepository
{
  collectionName: string
  mongoClient: MongoClient

  constructor(collectionName: string, mongoClient: MongoClient) {
    this.collectionName = collectionName
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
    unique?: boolean
  ): Promise<SourceDocument[]> {
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
    const pipeline =
      Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []
    let sources = await collection.aggregate(pipeline).toArray()
    if (unique) {
      const uniqueSources = new Map<string, SourceDocument>()
      for (const source of sources) {
        if (!uniqueSources.has(source.sourceName)) {
          uniqueSources.set(source.sourceName, source)
        }
      }
      sources = Array.from(uniqueSources.values())
    }
    return sources as SourceDocument[]
  }
}
