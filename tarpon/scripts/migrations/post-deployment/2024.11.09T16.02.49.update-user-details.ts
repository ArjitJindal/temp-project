import { v4 as uuidv4 } from 'uuid'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts/repository'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClientDb()

  const usersCollection = mongoDb.collection(USERS_COLLECTION(tenant.id))
  const users = await usersCollection
    .find({
      type: 'BUSINESS',
      $or: [
        {
          'shareHolders.userId': { $exists: false },
          shareHolders: { $exists: true, $ne: [] },
        },
        {
          'directors.userId': { $exists: false },
          directors: { $exists: true, $ne: [] },
        },
      ],
    })
    .toArray()

  for (const user of users) {
    const updates: any = {}

    if (Array.isArray(user.shareHolders)) {
      updates.shareHolders = user.shareHolders.map((shareHolder: any) => ({
        ...shareHolder,
        userId: shareHolder.userId || uuidv4(),
      }))
    }

    if (Array.isArray(user.directors)) {
      updates.directors = user.directors.map((director: any) => ({
        ...director,
        userId: director.userId || uuidv4(),
      }))
    }

    if (Object.keys(updates).length > 0) {
      try {
        await usersCollection.updateOne({ _id: user._id }, { $set: updates })
      } catch (error) {
        console.error(`Failed to update user ${user._id}:`, error)
        throw error
      }
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
