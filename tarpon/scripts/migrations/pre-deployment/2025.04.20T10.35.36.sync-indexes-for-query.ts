import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { hasFeature } from '@/core/utils/context'
import {
  DELTA_SANCTIONS_COLLECTION,
  SANCTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  if (hasFeature('DOW_JONES')) {
    const db = await getMongoDbClientDb()
    const sanctionsCollection = db.collection(SANCTIONS_COLLECTION(tenant.id))
    await Promise.all([
      sanctionsCollection.createIndex({
        name: 1,
      }),
      sanctionsCollection.createIndex({
        normalizedAka: 1,
      }),
    ])
    const deltaSanctionsCollection = db.collection(
      DELTA_SANCTIONS_COLLECTION(tenant.id)
    )
    await Promise.all([
      deltaSanctionsCollection.createIndex({
        name: 1,
      }),
      deltaSanctionsCollection.createIndex({
        normalizedAka: 1,
      }),
    ])
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
  const db = await getMongoDbClientDb()
  const acurisCollections = (await db.listCollections().toArray()).filter((c) =>
    c.name.includes('acuris')
  )
  if (acurisCollections.length > 0) {
    for (const collection of acurisCollections) {
      const c = db.collection(collection.name)
      await Promise.all([
        c.createIndex({
          name: 1,
        }),
        c.createIndex({
          normalizedAka: 1,
        }),
      ])
    }
  }
  const openSanctionsCollections = (
    await db.listCollections().toArray()
  ).filter((c) => c.name.includes('open-sanctions'))
  if (openSanctionsCollections.length > 0) {
    for (const collection of openSanctionsCollections) {
      const c = db.collection(collection.name)
      await Promise.all([
        c.createIndex({
          name: 1,
        }),
        c.createIndex({
          normalizedAka: 1,
        }),
      ])
    }
  }
  const deltaSanctionsCollections = (
    await db.listCollections().toArray()
  ).filter((c) => c.name.includes('delta-sanctions'))
  if (deltaSanctionsCollections.length > 0) {
    for (const collection of deltaSanctionsCollections) {
      const c = db.collection(collection.name)
      await Promise.all([
        c.createIndex({
          name: 1,
        }),
        c.createIndex({
          normalizedAka: 1,
        }),
      ])
    }
  }
}
export const down = async () => {
  // skip
}
