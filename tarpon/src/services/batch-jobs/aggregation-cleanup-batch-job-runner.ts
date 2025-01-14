/* eslint-disable import/no-restricted-paths */
import { StackConstants } from '@lib/constants'
import pMap from 'p-map'
import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { MongoError } from 'mongodb'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { getAggVarHash } from '../logic-evaluator/engine/aggregation-repository'
import { getConfig } from '../../../scripts/migrations/utils/config'
import { TenantService } from '../tenants'
import { BatchJobRunner } from './batch-job-runner-base'
import { AggregationCleanupBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient, paginateQuery } from '@/utils/dynamodb'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export class AggregationCleanupBatchJobRunner extends BatchJobRunner {
  protected async run(_job: AggregationCleanupBatchJob) {
    const config = getConfig()
    const tenantInfos = await TenantService.getAllTenants(
      config.stage,
      config.region
    )

    for (const tenantInfo of tenantInfos) {
      const tenantId = tenantInfo.tenant.id
      /* eslint-disable-next-line no-constant-condition */
      while (true) {
        try {
          await this.cleanupAggVarData(tenantId)
          logger.info(`Cleaned up aggregation data for Id: ${tenantId}`)
          break
        } catch (error) {
          if ((error as MongoError).code === 43) {
            logger.error(`Cursor expired, retrying...`)
            continue
          }
          throw error
        }
      }
    }

    logger.info(`Cleaned up aggregation var data for all tenants successfully`)
  }

  private async cleanupAggVarData(tenantId: string) {
    const migrationKey = `aggregation-cleanup-batch-job-${tenantId}`
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClientDb()
    const migrationProgress = await getMigrationLastCompletedTimestamp(
      migrationKey
    )
    const ruleInstances = await new RuleInstanceRepository(tenantId, {
      dynamoDb,
    }).getActiveRuleInstances()
    const usedAggVars = ruleInstances
      .flatMap((v) => v.logicAggregationVariables ?? [])
      .filter((v) => v.lastNEntities == null)
    const usersCollection = mongoDb.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    logger.info(`Starting from ${migrationProgress ?? 0}`)
    const usersCursor = usersCollection
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
          const { PartitionKeyID } =
            DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION(
              tenantId,
              user.userId,
              getAggVarHash(usedAggVar),
              tenantId === 'YDTX15USTG' ? user.userId : undefined
            )
          const { Items = [] } = await paginateQuery(dynamoDb, {
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
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
                  TableName:
                    StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
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
        await updateMigrationLastCompletedTimestamp(
          migrationKey,
          user.createdAt
        )
      }
    }
  }
}
