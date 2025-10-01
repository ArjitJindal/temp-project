import chunk from 'lodash/chunk'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { MongoClient } from 'mongodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { BatchRerunUsersService } from '../batch-users-rerun'
import { BatchJobRunner } from './batch-job-runner-base'
import { getSQSClient, bulkSendMessages } from '@/utils/sns-sqs-client'
import { BatchRerunUsers } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  BatchRerunUsersJobPayload,
  BatchRerunUsersJobType,
} from '@/@types/rerun-users'
import { traceable } from '@/core/xray'
import { envIs } from '@/utils/env'

const BATCH_SIZE = 1000

@traceable
export class BatchRerunUsersBatchJobRunner extends BatchJobRunner {
  private async sendMessageToQueue(
    tenantId: string,
    userIds: string[],
    jobType: BatchRerunUsersJobType,
    sqsClient: SQSClient,
    connections: { dynamoDb: DynamoDBClient; mongoDb: MongoClient }
  ) {
    const service = new BatchRerunUsersService(tenantId, connections)
    const chunks = chunk(userIds, 100)
    const messages: BatchRerunUsersJobPayload[] = chunks.map((chunk) => ({
      jobId: this.jobId,
      jobType,
      userIds: chunk,
      tenantId,
    }))

    if (envIs('local') || envIs('test')) {
      await service.incrementSentUserCount(this.jobId, userIds.length)
      await Promise.all(messages.map((message) => service.run(message)))
      return
    }

    await bulkSendMessages(
      sqsClient,
      process.env.BATCH_RERUN_USERS_QUEUE_URL as string,
      messages.map((message) => ({
        MessageBody: JSON.stringify(message),
      }))
    )

    await service.incrementSentUserCount(this.jobId, userIds.length)
  }

  protected async run(job: BatchRerunUsers) {
    const sqsClient = getSQSClient()
    const { tenantId } = job
    const dynamoDb = getDynamoDbClient()
    const subJobType = job.parameters.jobType
    const mongoDb = await getMongoDbClient()
    const usersCollection = mongoDb
      .db()
      .collection<InternalUser>(USERS_COLLECTION(tenantId))
    const service = new BatchRerunUsersService(tenantId, { dynamoDb, mongoDb })
    await service.createJobProgress(this.jobId)

    const users = usersCollection
      .find({})
      .project({ userId: 1 })
      .sort({ createdAt: -1 })

    const batchUserIds: string[] = []

    for await (const user of users) {
      batchUserIds.push(user.userId)

      if (batchUserIds.length >= BATCH_SIZE) {
        await this.sendMessageToQueue(
          tenantId,
          batchUserIds,
          subJobType,
          sqsClient,
          { dynamoDb, mongoDb }
        )

        batchUserIds.length = 0
      }
    }

    if (batchUserIds.length > 0) {
      await this.sendMessageToQueue(
        tenantId,
        batchUserIds,
        subJobType,
        sqsClient,
        { dynamoDb, mongoDb }
      )
    }
  }
}
