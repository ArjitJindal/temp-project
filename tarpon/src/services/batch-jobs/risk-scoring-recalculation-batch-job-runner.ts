import pMap from 'p-map'
import { chunk, difference, uniq } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { ListRepository } from '../list/repositories/list-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { BatchJobRunner } from './batch-job-runner-base'
import { RiskScoringTriggersBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'

const MAX_CONCURRENCY = 100

export class RiskScoringRecalculationBatchJobRunner extends BatchJobRunner {
  private tenantId?: string
  private mongoDb?: MongoClient
  private dynamoDb?: DynamoDBDocumentClient
  private usersRepository?: UserRepository
  private listRepository?: ListRepository
  private logicEvaluator?: LogicEvaluator
  private riskScoringV8Service?: RiskScoringV8Service

  protected async run(job: RiskScoringTriggersBatchJob) {
    logger.info('Running batch job to re run risk scoring on triggers')
    await this.initialize(job)

    const userIdsToReRun = await this.getUserIdsToReRun(job.parameters)
    await this.processUsers(userIdsToReRun)
  }

  private async initialize(job: RiskScoringTriggersBatchJob) {
    this.tenantId = job.tenantId
    this.mongoDb = await getMongoDbClient()
    this.dynamoDb = getDynamoDbClient()
    this.usersRepository = new UserRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })
    this.listRepository = new ListRepository(this.tenantId, this.dynamoDb)

    this.logicEvaluator = new LogicEvaluator(this.tenantId, this.dynamoDb)
    this.logicEvaluator.setMode('MONGODB')

    this.riskScoringV8Service = new RiskScoringV8Service(
      this.tenantId,
      this.logicEvaluator,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )
  }

  private async getUserIdsToReRun(
    parameters: RiskScoringTriggersBatchJob['parameters']
  ): Promise<string[]> {
    const { userIds: inputUserIds, clearedListIds } = parameters
    let userIdsToReRun: string[] = inputUserIds ?? []

    if (clearedListIds) {
      const listUserIds = await Promise.all(
        clearedListIds.map((listId) => this.getDeletedListUserIds(listId))
      )
      userIdsToReRun = userIdsToReRun.concat(...listUserIds)
    }

    return userIdsToReRun
  }

  private async getDeletedListUserIds(listId: string): Promise<string[]> {
    const listHeader = await this.listRepository?.getListHeader(listId)
    const oldVersion = listHeader?.version ? listHeader.version - 1 : undefined

    const previousUserIds = await this.getAllListUserIds(listId, oldVersion)
    const currentUserIds = await this.getAllListUserIds(listId)

    return difference(previousUserIds, currentUserIds)
  }

  private async getAllListUserIds(
    listId: string,
    version?: number
  ): Promise<string[]> {
    let userIds: string[] = []
    let next: string | undefined
    let hasNext = true

    while (hasNext) {
      const data = await this.listRepository?.getListItems(
        listId,
        { fromCursorKey: next, pageSize: 100 },
        version
      )

      userIds = userIds.concat(data?.items.map((item) => item.key) ?? [])
      hasNext = data?.hasNext ?? false
      next = data?.next
    }

    return userIds
  }

  private async processUsers(userIds: string[]) {
    for (const userIdChunk of chunk(uniq(userIds), 1000)) {
      const users =
        (await this.usersRepository?.getMongoUsersByIds(userIdChunk)) ?? []
      await pMap(
        users,
        async (user) => {
          logger.info(`Processing user: ${user.userId}`)
          await this.riskScoringV8Service?.handleUserUpdate(user)
        },
        { concurrency: MAX_CONCURRENCY }
      )
    }
  }
}
