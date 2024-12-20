import { StackConstants } from '@lib/constants'
import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { MongoError } from 'mongodb'
import pMap from 'p-map'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { Tenant } from '@/services/accounts'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { getDynamoDbClient, paginateQuery } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { logger } from '@/core/logger'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getAggVarHash } from '@/services/logic-evaluator/engine/aggregation-repository'

async function migrateTenant(tenant: Tenant) {
  const migrationKey = `2024.12.20T14.03.40.clean-up-agg-data-${tenant.id}`
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClientDb()
  const migrationProgress = await getMigrationLastCompletedTimestamp(
    migrationKey
  )
  const ruleInstances = await new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  }).getActiveRuleInstances()
  const usedAggVars = ruleInstances
    .flatMap((v) => v.logicAggregationVariables ?? [])
    .filter((v) => v.lastNEntities == null)
  const usersCollection = mongoDb.collection<InternalUser>(
    USERS_COLLECTION(tenant.id)
  )
  logger.info(`Starting from ${migrationProgress ?? 0}`)
  const usersCursor = await usersCollection
    .find({
      createdAt: { $gte: migrationProgress ?? 0 },
    })
    .sort({ createdAt: 1 })
    .addCursorFlag('noCursorTimeout', true)
  const totalUsers = await usersCollection.estimatedDocumentCount()
  let count = 0
  for await (const user of usersCursor) {
    await Promise.all(
      usedAggVars.map(async (usedAggVar) => {
        const { PartitionKeyID } = DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION(
          tenant.id,
          user.userId,
          getAggVarHash(usedAggVar),
          tenant.id === 'YDTX15USTG' ? user.userId : undefined
        )
        const { Items = [] } = await paginateQuery(dynamoDb, {
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
          KeyConditionExpression: 'PartitionKeyID = :pk',
          FilterExpression: 'attribute_exists(entities)',
          ExpressionAttributeValues: {
            ':pk': PartitionKeyID,
          },
        })
        if (Items.length > 0) {
          await pMap(
            Items,
            async (item) => {
              const updateItemInput: UpdateCommandInput = {
                TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenant.id),
                Key: {
                  PartitionKeyID: item.PartitionKeyID,
                  SortKeyID: item.SortKeyID,
                },
                UpdateExpression: `REMOVE entities`,
              }
              await dynamoDb.send(new UpdateCommand(updateItemInput))
            },
            { concurrency: 100 }
          )
        }
      })
    )
    count += 1
    if (count % 100 === 0) {
      logger.info(`Processed ${count} / ${totalUsers}`)
    }
    if (user.createdAt) {
      await updateMigrationLastCompletedTimestamp(migrationKey, user.createdAt)
    }
  }
}

export const up = async () => {
  await migrateAllTenants(async (tenant) => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await migrateTenant(tenant)
        return
      } catch (error) {
        // Ref: https://www.mongodb.com/docs/manual/reference/error-codes/
        if ((error as MongoError).code === 43) {
          logger.error(`Cursor expired, retrying...`)
          continue
        }
        throw error
      }
    }
  })
}
export const down = async () => {
  // skip
}
