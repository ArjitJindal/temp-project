import { AnyBulkWriteOperation, Document } from 'mongodb'
import {
  sandboxTenants,
  productionTenants,
} from '../utils/previous-deleted-tenant-names'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { TENANT_DELETION_COLLECTION } from '@/utils/mongo-table-names'
import { envIs } from '@/utils/env'

export const up = async () => {
  if (!envIs('sandbox') && !envIs('prod')) {
    return
  }
  const mongoDb = await getMongoDbClientDb()
  const deletedTenantCollection = mongoDb.collection(TENANT_DELETION_COLLECTION)
  const deletedTenants = await deletedTenantCollection.find({}).toArray()

  const bulkOperation: AnyBulkWriteOperation<Document>[] = []
  deletedTenants.forEach((tenant) => {
    const tenantId = tenant.tenantId
    let tenantName = null

    if (envIs('sandbox') && tenantId in sandboxTenants) {
      tenantName = sandboxTenants[tenantId]
    } else if (envIs('prod') && tenantId in productionTenants) {
      tenantName = productionTenants[tenantId]
    }

    if (tenantName) {
      bulkOperation.push({
        updateOne: {
          filter: { _id: tenant._id },
          update: { $set: { tenantName } },
        },
      })
    }
  })

  const BATCH_SIZE = 10
  let pointer = 0

  while (pointer < bulkOperation.length) {
    const endPointer = Math.min(pointer + BATCH_SIZE, bulkOperation.length)
    const batchOperation = bulkOperation.slice(pointer, endPointer)
    pointer = endPointer
    if (batchOperation.length > 0) {
      await deletedTenantCollection.bulkWrite(batchOperation)
    }
  }
}
export const down = async () => {
  // skip
}
