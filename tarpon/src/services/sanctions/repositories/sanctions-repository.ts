import {
  Action,
  Entity,
  SanctionsDataProviderName,
  SanctionsRepository,
} from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'

export class MongoSanctionsRepository implements SanctionsRepository {
  async save(
    provider: SanctionsDataProviderName,
    entities: [Action, Entity][],
    version: string
  ): Promise<void> {
    const client = await getMongoDbClient()
    const coll = client.db().collection(SANCTIONS_COLLECTION)

    const operations = entities.map(([action, entity]) => {
      switch (action) {
        case 'add':
          return {
            insertOne: {
              document: {
                ...entity,
                provider,
                version,
                createdAt: Date.now(),
              },
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
}
