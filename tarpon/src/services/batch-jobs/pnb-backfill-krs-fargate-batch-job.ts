import pMap from 'p-map'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { BatchJobRunner } from './batch-job-runner-base'
import { PnbBackfillKrs } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'

export class PnbBackfillKrsBatchJobRunner extends BatchJobRunner {
  private progressKey!: string
  private riskScoringService!: RiskScoringV8Service

  protected async run(job: PnbBackfillKrs): Promise<void> {
    const { tenantId } = job
    const { concurrency } = job.parameters

    const db = await getMongoDbClientDb()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    this.riskScoringService = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { mongoDb: await getMongoDbClient(), dynamoDb }
    )

    this.progressKey = `backfill-krs-${tenantId}`
    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.progressKey)) ?? 0
    const cursor = db
      .collection<InternalUser>(USERS_COLLECTION(tenantId))
      .find({ createdTimestamp: { $gt: lastCompletedTimestamp } })
      .sort({ createdTimestamp: 1 })

    let batchUsers: InternalUser[] = []
    for await (const user of cursor) {
      batchUsers.push(user)
      if (batchUsers.length === 10000) {
        await this.processBatch(batchUsers, concurrency)
        batchUsers = []
        logger.warn(`Processed ${batchUsers.length} users`)
      }
    }
    await this.processBatch(batchUsers, concurrency)
  }

  private async processBatch(batchUsers: InternalUser[], concurrency: number) {
    await pMap(
      batchUsers,
      async (user, index) => {
        await this.riskScoringService.handleUserUpdate(user)
        if (index % 100 === 0) {
          await updateMigrationLastCompletedTimestamp(
            this.progressKey,
            user.createdTimestamp
          )
        }
      },
      {
        concurrency,
      }
    )
  }
}
