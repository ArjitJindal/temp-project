import { migrateAllTenants } from '../utils/tenant'
import { logger } from '@/core/logger'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  createMongoDBCollections,
  getMongoDbClient,
  createGlobalMongoDBCollections,
} from '@/utils/mongodb-utils'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === '4c9cdf0251') {
    return
  }
  const mongodb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  await createMongoDBCollections(mongodb, dynamoDb, tenant.id)
  console.info(`MongoDB indexes synced for tenant: ${tenant.id}`)
}

export async function syncMongoDbIndexes() {
  await migrateAllTenants(migrateTenant)
  const mongodb = await getMongoDbClient()
  await createGlobalMongoDBCollections(mongodb)
}

if (require.main === module) {
  void syncMongoDbIndexes()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}
