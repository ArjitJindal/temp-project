import { chunk, memoize, uniq } from 'lodash'
import pMap from 'p-map'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { CaseRepository } from '../cases/repository'
import { AlertsRepository } from '../alerts/repository'
import { RulesEngineService } from '../rules-engine/rules-engine-service'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { UpdateTransactionStatusBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'

export class UpdateTransactionStatusBatchJobRunner extends BatchJobRunner {
  private cases = memoize(
    async (
      caseIds: string[],
      mongoDb: MongoClient,
      dynamoDb: DynamoDBDocumentClient,
      tenantId: string
    ) => {
      const caseRepository = new CaseRepository(tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await caseRepository.getCasesByIds(caseIds)
    }
  )
  private alerts = memoize(
    async (
      alertIds: string[],
      mongoDb: MongoClient,
      dynamoDb: DynamoDBDocumentClient,
      tenantId: string
    ) => {
      const alertRepository = new AlertsRepository(tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await alertRepository.getAlertsByIds(alertIds)
    }
  )
  protected async run(job: UpdateTransactionStatusBatchJob): Promise<void> {
    const { tenantId, parameters } = job
    const { updatedTransactionStatus, comment, reason, otherReason } =
      parameters
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const transactionRepository = new MongoDbTransactionRepository(
      tenantId,
      mongoDb,
      dynamoDb
    )
    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const alertRepository = new AlertsRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })

    const transactionIds: string[] = []

    if (parameters.type === 'CASE') {
      const cases = await this.cases(
        parameters.caseIds,
        mongoDb,
        dynamoDb,
        tenantId
      )
      transactionIds.push(
        ...uniq(cases.flatMap((c) => c.caseTransactionsIds ?? []))
      )
    } else {
      const alerts = await this.alerts(
        parameters.alertIds,
        mongoDb,
        dynamoDb,
        tenantId
      )
      transactionIds.push(
        ...uniq(alerts.flatMap((a) => a.transactionIds ?? []))
      )
    }

    const transactions = await transactionRepository.getTransactionsByIds(
      transactionIds,
      { status: 'SUSPEND' },
      { transactionId: 1 }
    )

    const suspendedTransactionIds = transactions.map((t) => t.transactionId)

    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const rulesEngine = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )

    const chunkedTransactionIds = chunk(suspendedTransactionIds, 100)

    await pMap(
      chunkedTransactionIds,
      async (transactionIds) => {
        await rulesEngine.applyTransactionAction(
          {
            transactionIds,
            action: updatedTransactionStatus,
            reason: reason as CaseReasons[],
            comment: comment ?? '',
            otherReason: otherReason,
          },
          parameters.userId
        )
      },
      { concurrency: 10 }
    )

    if (parameters.type === 'CASE') {
      const cases = await this.cases(
        parameters.caseIds,
        mongoDb,
        dynamoDb,
        tenantId
      )
      for (const c of cases) {
        const transactionsForThisCase = suspendedTransactionIds.filter((tid) =>
          (c.caseTransactionsIds ?? []).includes(tid)
        )
        const commentText = `Transactions: ${transactionsForThisCase.join(
          ', '
        )} set to ${updatedTransactionStatus}.\nReasons: ${reason.join(', ')} ${
          otherReason ? `Other reason: ${otherReason}` : ''
        }.\nComment: ${comment ?? ''}`
        await caseRepository.saveCasesComment([c.caseId as string], {
          body: commentText,
          files: [],
        })
      }
    } else {
      const alerts = await this.alerts(
        parameters.alertIds,
        mongoDb,
        dynamoDb,
        tenantId
      )
      for (const a of alerts) {
        const transactionsForThisAlert = transactionIds.filter((tid) =>
          a.transactionIds?.includes(tid)
        )
        const commentText = `Transactions: ${transactionsForThisAlert.join(
          ', '
        )} set to ${updatedTransactionStatus}.\nReasons: ${reason.join(', ')} ${
          otherReason ? `Other reason: ${otherReason}` : ''
        }.\nComment: ${comment ?? ''}`
        await alertRepository.saveComment(
          a.caseId as string,
          a.alertId as string,
          {
            body: commentText,
            files: [],
          }
        )
      }
    }
  }
}
