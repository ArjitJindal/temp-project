import { nanoid } from 'nanoid'
import {
  createMongoDBCollections,
  getMongoDbClient,
} from '@/utils/mongodb-utils'

// NOTE: Use this for getting a unique tenant ID in each test suite, then we can support
// running tests in parallel without interferring each other.
export function getTestTenantId() {
  return `TEST-TENANT-${nanoid()}`
}

export async function getTestTenantIdAndCreateCollections() {
  const tenantId = getTestTenantId()
  const mongodb = await getMongoDbClient()
  await createMongoDBCollections(mongodb, tenantId)
  return tenantId
}
