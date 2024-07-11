import { ObjectId } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsHit } from '@/@types/openapi-internal/all'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  // Remove duplicate searches
  {
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_SEARCHES_COLLECTION(tenant.id)
    )

    const duplicates = collection.aggregate<{ ids: ObjectId[] }>([
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: {
            searchId: '$response.rawComplyAdvantageResponse.content.data.id',
          },
          ids: {
            $addToSet: '$_id',
          },
          count: {
            $count: {},
          },
        },
      },
      {
        $match: {
          count: {
            $gt: 1,
          },
        },
      },
    ])
    const idsToDelete: ObjectId[] = []
    for await (const duplicate of duplicates) {
      const extraIds = duplicate.ids.slice(1)
      idsToDelete.push(...extraIds)
    }
    const deleteResult = await collection.deleteMany({
      _id: { $in: idsToDelete },
    })
    if (deleteResult.deletedCount > 0) {
      logger.info(
        `Deleted ${deleteResult.deletedCount} duplicate sanctions searches`
      )
    }
  }

  // Remove duplicate hits
  {
    const collection = db.collection<SanctionsHit>(
      SANCTIONS_HITS_COLLECTION(tenant.id)
    )

    const duplicates = collection.aggregate<{ ids: ObjectId[] }>([
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: {
            searchId: '$searchId',
            caEntityDocId: '$caEntity.id',
          },
          ids: {
            $addToSet: '$_id',
          },
          count: {
            $count: {},
          },
        },
      },
      {
        $match: {
          count: {
            $gt: 1,
          },
        },
      },
    ])
    const idsToDelete: ObjectId[] = []
    for await (const duplicate of duplicates) {
      const extraIds = duplicate.ids.slice(1)
      idsToDelete.push(...extraIds)
    }
    const deleteResult = await collection.deleteMany({
      _id: { $in: idsToDelete },
    })
    if (deleteResult.deletedCount > 0) {
      logger.info(
        `Deleted ${deleteResult.deletedCount} duplicate sanctions hits`
      )
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
