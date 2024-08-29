import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const db = await getMongoDbClientDb()
  const dynamoDb = getDynamoDbClient()
  const collection = db.collection(USERS_COLLECTION(tenant.id))
  const cursor = collection.find<InternalUser>({
    'linkedEntities.childUserIds.0': { $exists: true },
  })
  for await (const user of cursor) {
    logger.info(`Removing childUserIds from user ${user.userId}`)
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER(tenant.id, user.userId),
      UpdateExpression: `REMOVE linkedEntities.childUserIds`,
    }
    await dynamoDb.send(new UpdateCommand(updateItemInput))
  }
  await collection.updateMany(
    { 'linkedEntities.childUserIds.0': { $exists: true } },
    { $unset: { 'linkedEntities.childUserIds': '' } }
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
