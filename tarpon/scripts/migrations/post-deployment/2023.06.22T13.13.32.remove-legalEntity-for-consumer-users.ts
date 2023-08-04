import _ from 'lodash'
import { StackConstants } from '@lib/constants'
import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { migrateEntities } from '../utils/mongodb'
import { migrateAllTenants } from '../utils/tenant'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { USERS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()
  const usersCollection = db.collection<InternalConsumerUser>(
    USERS_COLLECTION(tenant.id)
  )
  const migrationKey = `2023.06.22T13.13.32.remove-legalEntity-${tenant.id}`
  const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
    migrationKey
  )
  const cursor = usersCollection
    .find({
      createdTimestamp: { $gt: lastCompletedTimestamp ?? 0 },
      legalEntity: { $exists: true },
      type: 'CONSUMER',
    })
    .sort({ createdTimestamp: 1 })
    .maxTimeMS(60 * 60 * 1000) // 1 hour

  await migrateEntities<InternalConsumerUser>(cursor, async (usersBatch) => {
    for (const user of usersBatch) {
      const updateItemInput: UpdateCommandInput = {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.USER(tenant.id, user.userId),
        UpdateExpression: `REMOVE legalEntity`,
      }
      await dynamoDb.send(new UpdateCommand(updateItemInput))
    }
    await updateMigrationLastCompletedTimestamp(
      migrationKey,
      _.last(usersBatch)?.createdTimestamp ?? 0
    )
  })
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
