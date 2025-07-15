import { Document, Filter, MongoClient } from 'mongodb'
import { internalMongoUpdateOne } from './mongodb-utils'

export const applyNewVersion = (
  newEntity: object & { updateCount?: number },
  existingEntity?: (object & { updateCount?: number }) | null
): boolean => {
  if (!existingEntity) {
    return true
  }
  return (newEntity.updateCount ?? 1) > (existingEntity?.updateCount ?? 0)
}

export async function updateInMongoWithVersionCheck<T extends Document>(
  mongoDb: MongoClient,
  collectionName: string,
  filter: Filter<T>,
  entityWithVersion: object & { updateCount?: number },
  upsert: boolean
) {
  return await internalMongoUpdateOne<T>(
    mongoDb,
    collectionName,
    filter,
    [
      {
        $replaceWith: {
          $cond: {
            if: {
              $or: [
                {
                  $lt: [
                    { $ifNull: ['$updateCount', 0] },
                    entityWithVersion.updateCount ?? 1,
                  ],
                },
                { $not: '$updateCount' },
              ],
            },
            then: {
              ...entityWithVersion,
              _id: '$_id',
              createdAt: Date.now(),
            },
            else: '$$ROOT',
          },
        },
      },
    ],
    { upsert: upsert, returnFullDocument: true }
  )
}
