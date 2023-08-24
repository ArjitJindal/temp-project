import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { IBAN_COM_COLLECTION } from '@/utils/mongodb-definitions'
import { Tenant } from '@/services/accounts'
import { IBANApiHistory } from '@/services/iban.com/types'

async function migrateTenant(tenant: Tenant) {
  const db = (await getMongoDbClient()).db()
  const collection = db.collection<IBANApiHistory>(
    IBAN_COM_COLLECTION(tenant.id)
  )
  const cursor = collection.aggregate([
    {
      $group: {
        _id: '$request.iban',
        doc: { $first: '$$ROOT' },
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ])

  for await (const item of cursor) {
    const iban = item._id
    await collection.deleteMany({ 'request.iban': iban })
    await collection.insertOne(item.doc)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
