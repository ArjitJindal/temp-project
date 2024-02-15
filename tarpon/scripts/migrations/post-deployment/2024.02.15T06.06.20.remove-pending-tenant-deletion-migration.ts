import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DeleteTenant } from '@/@types/openapi-internal/DeleteTenant'
import { TENANT_DELETION_COLLECTION } from '@/utils/mongodb-definitions'

export const up = async () => {
  const mongoDb = (await getMongoDbClient()).db()
  const tenantCollection = mongoDb.collection<DeleteTenant>(
    TENANT_DELETION_COLLECTION
  )

  await tenantCollection.deleteMany({ latestStatus: { $ne: 'HARD_DELETED' } })
}
export const down = async () => {
  // skip
}
