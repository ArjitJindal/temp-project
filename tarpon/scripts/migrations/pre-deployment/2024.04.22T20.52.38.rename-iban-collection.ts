import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { IBAN_COLLECTION } from '@/utils/mongodb-definitions'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const collections = await db.listCollections().toArray()
  const collectionExists = collections.some(
    (c) => c.name === `${tenant.id}-iban-com`
  )
  if (!collectionExists) {
    return
  }

  await db.renameCollection(
    `${tenant.id}-iban-com`,
    `${IBAN_COLLECTION(tenant.id)}`
  )
  const collection = db.collection(IBAN_COLLECTION(tenant.id))
  await collection.updateMany({}, { $rename: { response: 'rawResponse' } })
  await collection.updateMany({}, [
    {
      $set: {
        'response.bankName': '$rawResponse.bank_data.bank',
        'response.bic': '$rawResponse.bank_data.bic',
        'response.branchCode': '$rawResponse.bank_data.branch_code',
        'response.address': '$rawResponse.bank_data.address',
        'response.zip': '$rawResponse.bank_data.zip',
        'response.city': '$rawResponse.bank_data.city',
        'response.country': '$rawResponse.bank_data.country',
        'response.state': '$rawResponse.bank_data.state',
      },
    },
  ])
  await collection.updateMany(
    {},
    { $unset: { type: '' }, $set: { source: 'iban.com' } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
