import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  SANCTIONS_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongo-table-names'
import { Tenant } from '@/@types/tenant'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  // sanctions
  const sanctionsCollection = db.collection(SANCTIONS_COLLECTION(tenant.id))
  await sanctionsCollection.updateMany({ yearOfBirth: { $type: 'string' } }, [
    { $set: { yearOfBirth: ['$yearOfBirth'] } },
  ])
  // sanctions-hits
  const sanctionsHitsCollection = db.collection(
    SANCTIONS_HITS_COLLECTION(tenant.id)
  )
  await sanctionsHitsCollection.updateMany(
    { 'entity.yearOfBirth': { $type: 'string' } },
    [{ $set: { 'entity.yearOfBirth': ['$entity.yearOfBirth'] } }]
  )
  // sanctions-whitelist-entities
  const sanctionsWhitelistEntitiesCollection = db.collection(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenant.id)
  )
  await sanctionsWhitelistEntitiesCollection.updateMany(
    { 'sanctionsEntity.yearOfBirth': { $type: 'string' } },
    [
      {
        $set: {
          'sanctionsEntity.yearOfBirth': ['$sanctionsEntity.yearOfBirth'],
        },
      },
    ]
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
