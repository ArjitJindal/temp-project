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
// Todo: Refactor this
function buildSafeSetFields(entity: any, base: any = '$$ROOT'): any {
  let current = base

  for (const [key, value] of Object.entries(entity)) {
    let safeValue: any

    if (Array.isArray(value)) {
      // Recurse into array elements if they are objects
      safeValue = value.map((item) =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? buildSafeSetFields(item, {}) // {} starts clean for array objects
          : item
      )
    } else if (value && typeof value === 'object') {
      safeValue = buildSafeSetFields(value, {}) // fresh object for nested fields
    } else {
      if (typeof value === 'string' && value.startsWith('$')) {
        safeValue = { $literal: value }
      } else {
        safeValue = value
      }
    }

    current = {
      $setField: {
        field: key,
        input: current,
        value: safeValue,
      },
    }
  }

  return current
}

function buildSafeReplaceWith(entityWithVersion: Record<string, any>): any {
  // Start with setting _id and createdAt
  const withId = {
    $setField: {
      field: '_id',
      input: '$$ROOT',
      value: '$_id',
    },
  }

  const withCreatedAt = {
    $setField: {
      field: 'createdAt',
      input: withId,
      value: Date.now(),
    },
  }

  return buildSafeSetFields(entityWithVersion, withCreatedAt)
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
            then: buildSafeReplaceWith(entityWithVersion),
            else: '$$ROOT',
          },
        },
      },
    ],
    { upsert: upsert, returnFullDocument: true }
  )
}
