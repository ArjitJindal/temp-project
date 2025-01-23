import { StackConstants } from '@lib/constants'
import {
  GetCommand,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Business } from '@/@types/openapi-internal/Business'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '0789ad73b8') {
    return
  }

  const mongoDb = await getMongoDbClientDb()
  const dynamoDb = getDynamoDbClient()

  const usersCollection = mongoDb.collection(USERS_COLLECTION(tenant.id))
  const users = usersCollection.find({
    type: 'BUSINESS',
  })

  const userIds: string[] = []

  for await (const user of users) {
    try {
      const userKey = DynamoDbKeys.USER(tenant.id, user.userId)
      const userItem = await dynamoDb.send(
        new GetCommand({
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
          Key: userKey,
        })
      )

      logger.info(`Migrating user ${user.userId}`)

      if (!userItem.Item?.linkedEntities?.childUserIds) {
        continue
      }

      userIds.push(user.userId)
      logger.info(
        `Found ${user.userId} with ${userItem.Item?.linkedEntities?.childUserIds?.length} child user ids`
      )

      // Remove the child user ids from the user item
      const { linkedEntities, ...userWithoutLinkedEntities } =
        userItem.Item as Business

      // Add the child user ids to the user item
      const userWithChildUserIds = {
        ...userWithoutLinkedEntities,
        linkedEntities: {
          ...linkedEntities,
          childUserIds: undefined as any, // eslint-disable-line
        },
      }

      const updateItemInput: UpdateCommandInput = {
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
        Key: userKey,
        UpdateExpression: 'SET linkedEntities = :linkedEntities',
        ExpressionAttributeValues: {
          ':linkedEntities': userWithChildUserIds.linkedEntities,
        },
      }

      logger.info(`Updating user ${user.userId}`)

      await dynamoDb.send(new UpdateCommand(updateItemInput))

      logger.info(`Updated user ${user.userId}`)
    } catch (error) {
      logger.error(`Error migrating user ${user.userId}`, error)
      continue
    }
  }

  console.log(`Migrated ${userIds.length} users`, { userIds })

  logger.info(`Migrated ${userIds.length} users`)
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
