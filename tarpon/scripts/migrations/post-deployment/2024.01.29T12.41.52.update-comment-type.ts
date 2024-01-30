import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const collection = db.collection(CASES_COLLECTION(tenant.id))
  await collection.updateMany(
    { comments: { $exists: true } },
    {
      $set: {
        'comments.$[comment].type': 'STATUS_CHANGE',
      },
    },
    {
      arrayFilters: [
        {
          'comment.body': { $regex: '^Case status changed' },
        },
      ],
    }
  )
  await collection.updateMany(
    {},
    {
      $set: {
        'alerts.$[alert].comments': [],
      },
    },
    {
      arrayFilters: [
        {
          'alert.comments.0': { $exists: false },
        },
      ],
    }
  )
  await collection.updateMany(
    {},
    {
      $set: {
        'alerts.$[].comments.$[comment].type': 'STATUS_CHANGE',
      },
    },
    {
      arrayFilters: [
        {
          'comment.body': { $regex: '^Alert status changed' },
        },
      ],
    }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
