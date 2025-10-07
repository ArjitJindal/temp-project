import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { FixArsBreakdownBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { TRANSACTION_EVENTS_COLLECTION } from '@/utils/mongo-table-names'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { logger } from '@/core/logger'

const startTimestamp = 1737676800000

export class FixArsBreakdownBatchJobRunner extends BatchJobRunner {
  private riskFactors?: RiskFactor[]
  async run(job: FixArsBreakdownBatchJob) {
    const tenantId = job.tenantId
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()

    const transactionEventsCollection = mongoDb
      .db()
      .collection<InternalTransactionEvent>(
        TRANSACTION_EVENTS_COLLECTION(tenantId)
      )
    const txIdCursor = transactionEventsCollection.aggregate<{
      _id: string
    }>([
      {
        $match: {
          timestamp: { $gte: startTimestamp },
        },
      },
      {
        $sort: {
          timeStamp: 1,
        },
      },
      {
        $group: {
          _id: '$transactionId',
        },
      },
    ])
    let affectedTxCount = 0
    await processCursorInBatch(
      txIdCursor,
      async (txIdData) => {
        await Promise.all(
          txIdData.map((dt) =>
            this.handleTx(tenantId, { transactionId: dt._id }, dynamoDb)
          )
        )
        affectedTxCount += txIdData.length
      },
      {
        mongoBatchSize: 500,
        processBatchSize: 25,
      }
    )
    logger.info(
      `Fixed ars score breakdown for ${affectedTxCount} transactions with events`
    )
  }
  private async handleTx(
    tenantId: string,
    data: { transactionId: string },
    dynamoDb: DynamoDBDocumentClient
  ) {
    const txId = data.transactionId
    if (!txId) {
      return
    }
    const transactionsRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )
    const latestTx = await transactionsRepository.getTransactionById(txId)
    if (!latestTx) {
      return
    }
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb })
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      { dynamoDb }
    )
    if (!this.riskFactors) {
      this.riskFactors = await riskScoringV8Service.getActiveRiskFactors(
        'TRANSACTION'
      )
    }
    const ars = await riskScoringV8Service.calculateRiskFactorsScore(
      {
        transaction: latestTx,
        transactionEvents: [],
        type: 'TRANSACTION',
      },
      this.riskFactors
    )
    await riskRepository.createOrUpdateArsScore(
      txId,
      ars.riskFactorsResult.score,
      latestTx.originUserId,
      latestTx.destinationUserId,
      ars.riskFactorsResult.components,
      ars.riskFactorsResult.scoreDetails
    )
  }
}
