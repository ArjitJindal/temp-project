import pMap from 'p-map'
import last from 'lodash/last'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { FixRiskScoresForPnbUsers } from '@/@types/batch-job'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongo-table-names'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'

export class FixRiskScoresForPnbUsersBatchJobRunner extends BatchJobRunner {
  protected async run(job: FixRiskScoresForPnbUsers & { jobId: string }) {
    const { tenantId, parameters } = job
    const lastMigrationTimeStamp =
      (await getMigrationLastCompletedTimestamp(this.jobId)) ?? 0
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { mongoDb, dynamoDb }
    )
    const db = mongoDb.db()
    const collection = db.collection<InternalUser>(USERS_COLLECTION(tenantId))
    const affectedUsersCursor = collection
      .find({
        $and: [
          {
            createdTimestamp: { $gte: lastMigrationTimeStamp },
          },
          {
            $or: [
              { employmentDetails: { $exists: false } },
              {
                'employmentDetails.businessIndustry': null,
              },
              {
                'employmentDetails.businessIndustry': { $size: 0 },
              },
            ],
          },
        ],
      })
      .sort({ createdTimestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)
    let affectedUsersCount = 0
    await processCursorInBatch(
      affectedUsersCursor,
      async (users) => {
        await pMap(
          users,
          async (user) => {
            await riskScoringV8Service.handleUserUpdate({ user })
          },
          { concurrency: parameters.concurrency }
        )
        affectedUsersCount += users.length
        logger.info(`Processed ${users.length}  users`)
        await updateMigrationLastCompletedTimestamp(
          this.jobId,
          last(users)?.createdTimestamp ?? 0
        )
      },
      {
        mongoBatchSize: 1000,
        processBatchSize: 1000,
      }
    )
    logger.info(`Fixed risk scores for ${affectedUsersCount}`)
  }
}
