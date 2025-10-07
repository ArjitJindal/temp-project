import { MongoClient } from 'mongodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { UserEventRepository } from '../rules-engine/repositories/user-event-repository'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { UserRepository } from '../users/repositories/user-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  getMigrationLastCompletedId,
  updateMigrationLastCompletedId,
} from '@/utils/migration-progress'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongo-table-names'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { FixLocksForKrs } from '@/@types/batch-job'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { logger } from '@/core/logger'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

const startTime = 1732060800000

export class FixLocksForKrsBatchJobRunner extends BatchJobRunner {
  private tenantId!: string
  private mongoDb!: MongoClient
  private dynamoDb!: DynamoDBDocumentClient
  private migrationKey!: string
  protected async run(job: FixLocksForKrs) {
    this.tenantId = job.tenantId
    this.mongoDb = await getMongoDbClient()
    this.dynamoDb = getDynamoDbClient()
    const requestsCollection = this.mongoDb
      .db()
      .collection(API_REQUEST_LOGS_COLLECTION(this.tenantId))
    this.migrationKey = `fix-locks-for-krs-${this.tenantId}`
    const lastProcessedId =
      (await getMigrationLastCompletedId(this.migrationKey)) ?? ''
    const affectedUserCursor = requestsCollection.aggregate<{ _id: string }>([
      {
        $match: {
          path: {
            $in: [
              '/consumer/users',
              '/business/users',
              '/events/consumer/user',
              '/events/business/user',
            ],
          },
          method: 'POST',
          timestamp: { $gte: startTime },
          'payload.userId': { $gte: lastProcessedId },
        },
      },
      {
        $group: {
          _id: '$payload.userId',
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ])
    let usersCount = 0
    await processCursorInBatch(
      affectedUserCursor,
      async (userIds) => {
        await Promise.all(
          userIds.map(async (dt) => {
            await this.handleUser(dt._id)
          })
        )
        usersCount += userIds.length
      },
      {
        processBatchSize: 20,
        mongoBatchSize: 400,
      }
    )
    logger.info(
      `Fixed locked Krs in ${usersCount} users for tenant: ${this.tenantId}`
    )
  }
  private async handleUser(userId: string) {
    // Update KRS Lock
    const krsKey = DynamoDbKeys.KRS_VALUE_ITEM(this.tenantId, userId, '1')
    const getInput: GetCommandInput = {
      Key: krsKey,
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
    }
    const currentKrsItem = await this.dynamoDb.send(new GetCommand(getInput))
    if (!currentKrsItem.Item) {
      return
    }
    const currentKrs = currentKrsItem.Item as KrsScore
    if (!currentKrs.isLocked) {
      return
    }
    const updateInput: UpdateCommandInput = {
      Key: krsKey,
      UpdateExpression: 'SET isLocked=:isLocked',
      ExpressionAttributeValues: {
        ':isLocked': false,
      },
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(this.tenantId),
    }
    await this.dynamoDb.send(new UpdateCommand(updateInput))
    const userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })
    const userEventRepository = new UserEventRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(this.tenantId, this.dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      this.tenantId,
      logicEvaluator,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )
    const userEventCount = await userEventRepository.getUserEventsCount(userId)
    if (userEventCount > 1) {
      // Rerun Krs
      const userCurrent = await userRepository.getUser<
        Business | User | undefined
      >(userId)
      if (!userCurrent) {
        return
      }
      await riskScoringV8Service.handleUserUpdate({ user: userCurrent })
    }
    await updateMigrationLastCompletedId(this.migrationKey, userId)
    logger.info(`Fixed locked krs for user:${userId}`)
  }
}
