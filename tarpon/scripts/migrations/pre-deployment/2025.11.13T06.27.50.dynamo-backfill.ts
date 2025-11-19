import { Document } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { backfillCollection } from '../../backfill-collection'
import { Tenant } from '@/@types/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { COUNTER_COLLECTION } from '@/utils/mongo-table-names'
async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  // Backfill counter collection only for hong kong region
  if (tenant.region === 'ap-east-1') {
    await backfillCollection({
      mongoDb,
      dynamoDb,
      tenantId,
      collectionName: COUNTER_COLLECTION(tenantId),
      keyGenerator: (_: string, doc: Document) => {
        return DynamoDbKeys.COUNTER(tenantId, doc.entity as string)
      },
    })
  }
  await backfillCollection({
    mongoDb,
    dynamoDb,
    tenantId,
    collectionName: 'migrations-pre-deployment',
    keyGenerator: (_: string, doc: Document) => {
      return DynamoDbKeys.MIGRATION_PRE_DEPLOYMENT(doc.migrationName)
    },
  })
  await backfillCollection({
    mongoDb,
    dynamoDb,
    tenantId,
    collectionName: 'migrations-post-deployment',
    keyGenerator: (_: string, doc: Document) => {
      return DynamoDbKeys.MIGRATION_POST_DEPLOYMENT(doc.migrationName)
    },
  })
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
