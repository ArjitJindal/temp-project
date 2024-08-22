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
    action: Action,
    provider: SanctionsDataProviderName,
    entity: Entity
  ): Promise<void> {
    const client = await getMongoDbClient()
    const coll = client.db().collection(SANCTIONS_COLLECTION)

    if (action === 'add') {
      await coll.insertOne({
        ...entity,
        provider,
        createdAt: Date.now(),
      })
    }
    if (action === 'change') {
      await coll.replaceOne(
        {
          id: entity.id,
          provider,
          deletedAt: { $exists: false },
        },
        {
          entity,
          updatedAt: Date.now(),
        }
      )
    }
    if (action === 'remove') {
      await coll.replaceOne(
        {
          id: entity.id,
          provider,
          deletedAt: { $exists: false },
        },
        {
          ...entity,
          deletedAt: Date.now(),
        }
      )
    }
  }
}
