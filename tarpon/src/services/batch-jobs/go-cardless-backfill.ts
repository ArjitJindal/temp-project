import { MongoClient } from 'mongodb'
import pMap from 'p-map'
import { SQSClient } from '@aws-sdk/client-sqs'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { TransactionEventRepository } from '../rules-engine/repositories/transaction-event-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { GoCardlessBackfillBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  API_REQUEST_LOGS_COLLECTION,
  ARS_SCORES_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { ApiRequestLog } from '@/@types/request-logger'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import {
  DynamoDbEntityType,
  DynamoDbEntityUpdate,
} from '@/core/dynamodb/dynamodb-stream-utils'
import { generateChecksum } from '@/utils/object'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { bulkSendMessages } from '@/utils/sns-sqs-client'

interface SendEntityToSQSParams {
  tenantId: string
  entityId: string
  type: DynamoDbEntityType
  keys: { PartitionKeyID: string; SortKeyID?: string }
  data: any
  sqsClient: SQSClient
}

const DEFAULT_CONCURRENCY = 1000

export class GoCardlessBackfillBatchJobRunner extends BatchJobRunner {
  private dynamoDbTransactionRepository!: DynamoDbTransactionRepository // eslint-disable-line @typescript-eslint/no-unused-vars
  private riskRepository!: RiskRepository // eslint-disable-line @typescript-eslint/no-unused-vars
  private eventsRepository!: TransactionEventRepository // eslint-disable-line @typescript-eslint/no-unused-vars

  /**
   * Validates transactions and returns IDs that need to be rerun
   */
  private async validateTransactions(
    tenantId: string,
    transactionIds: string[],
    mongoDb: MongoClient
  ): Promise<{
    arsIds: string[]
    eventIds: string[]
    transactionIds: string[]
  }> {
    if (transactionIds.length === 0) {
      return {
        arsIds: [],
        eventIds: [],
        transactionIds: [],
      }
    }

    const db = mongoDb.db()

    const [transactions, transactionEvents, arsScores] = await Promise.all([
      db
        .collection<Transaction>(TRANSACTIONS_COLLECTION(tenantId))
        .find(
          { transactionId: { $in: transactionIds } },
          { projection: { transactionId: 1, timestamp: 1 } }
        )
        .toArray(),
      db
        .collection<TransactionEvent>(TRANSACTION_EVENTS_COLLECTION(tenantId))
        .find(
          { transactionId: { $in: transactionIds } },
          { projection: { transactionId: 1 } }
        )
        .toArray(),
      db
        .collection<ArsScore>(ARS_SCORES_COLLECTION(tenantId))
        .find(
          { transactionId: { $in: transactionIds } },
          { projection: { transactionId: 1 } }
        )
        .toArray(),
    ])

    // Create sets for O(1) lookup performance
    const transactionIdSet = new Set(
      transactionIds.filter(
        (id) => !transactions.some((t) => t.transactionId === id)
      )
    ) // Transactions that are not in the database
    const eventsIdSet = new Set(
      transactionIds.filter(
        (id) => !transactionEvents.some((e) => e.transactionId === id)
      )
    )
    // Events that are not in the database
    const arsScoresIdSet = new Set(
      transactionIds.filter(
        (id) => !arsScores.some((s) => s.transactionId === id)
      )
    ) // ARS scores that are not in the database

    // Single pass through transactionIds to find all issues

    // Check for transactions without timestamp
    for (const transaction of transactions) {
      if (transaction.timestamp == null) {
        transactionIdSet.add(transaction.transactionId)
      }
    }

    return {
      transactionIds: Array.from(transactionIdSet),
      eventIds: Array.from(eventsIdSet),
      arsIds: Array.from(arsScoresIdSet),
    }
  }

  /**
   * Reruns transactions with improved error handling and retry logic
   */
  private async rerunEntities<T>(
    tenantId: string,
    entityIds: string[],
    sqsClient: SQSClient,
    {
      type,
      getData,
      getKeys,
    }: {
      type: DynamoDbEntityType
      getData: (id: string) => Promise<T | null | undefined>
      getKeys: (
        tenantId: string,
        entity: T
      ) => { PartitionKeyID: string; SortKeyID?: string }
    }
  ): Promise<void> {
    if (entityIds.length === 0) {
      return
    }

    console.log(
      `Rerunning ${type}s: ${entityIds.length}, ${JSON.stringify(
        entityIds,
        null,
        2
      )}`
    )

    const messages: SendEntityToSQSParams[] = []

    await pMap(
      entityIds,
      async (entityId) => {
        const data = await getData(entityId)
        if (data == null) {
          console.warn(`${type} not found`, { entityId })
          return
        }
        messages.push({
          tenantId,
          entityId,
          type,
          keys: getKeys(tenantId, data),
          data,
          sqsClient,
        })
      },
      { concurrency: 100 }
    )

    await this.sendEntityToSQS(sqsClient, messages)

    console.log(`Sent ${messages.length} messages to SQS`)
  }

  private async rerunTransactions(
    tenantId: string,
    transactionIds: string[],
    sqsClient: SQSClient
  ): Promise<void> {
    await this.rerunEntities<Transaction>(tenantId, transactionIds, sqsClient, {
      type: 'TRANSACTION',
      getData: (transactionId: string) =>
        this.dynamoDbTransactionRepository.getTransactionById(transactionId),
      getKeys: (tenantId: string, transaction: Transaction) =>
        DynamoDbKeys.TRANSACTION(tenantId, transaction.transactionId),
    })
  }

  private async rerunArsScores(
    tenantId: string,
    transactionIds: string[],
    sqsClient: SQSClient
  ): Promise<void> {
    if (transactionIds.length === 0) {
      return
    }

    const arsScores = await this.riskRepository.getArsScores(transactionIds)
    await this.rerunEntities<ArsScore>(
      tenantId,
      arsScores.map((arsScore) => arsScore.transactionId as string),
      sqsClient,
      {
        type: 'ARS_VALUE',
        getData: async (transactionId: string) =>
          arsScores.find(
            (arsScore) => arsScore.transactionId === transactionId
          ),
        getKeys: (tenantId: string, arsScore: ArsScore) =>
          DynamoDbKeys.ARS_VALUE_ITEM(
            tenantId,
            arsScore.transactionId as string,
            '1'
          ),
      }
    )
  }

  private async rerunTransactionEvents(
    tenantId: string,
    transactionIds: string[],
    sqsClient: SQSClient
  ): Promise<void> {
    await this.rerunEntities<TransactionEvent>(
      tenantId,
      transactionIds,
      sqsClient,
      {
        type: 'TRANSACTION_EVENT',
        getData: (transactionId: string) =>
          this.eventsRepository.getLastTransactionEvent(transactionId),
        getKeys: (tenantId: string, transactionEvent: TransactionEvent) =>
          DynamoDbKeys.TRANSACTION_EVENT(
            tenantId,
            transactionEvent.transactionId,
            {
              timestamp: transactionEvent.timestamp,
              eventId: transactionEvent.eventId as string,
            }
          ),
      }
    )
  }

  /**
   * Processes a batch of transactions efficiently
   */
  private async processBatchTransactions(
    tenantId: string,
    batch: Transaction[],
    mongoDb: MongoClient,
    sqsClient: SQSClient
  ): Promise<void> {
    if (batch.length === 0) {
      return
    }

    const transactionIdsToValidate = batch.map((t) => t.transactionId)
    const { arsIds, eventIds, transactionIds } =
      await this.validateTransactions(
        tenantId,
        transactionIdsToValidate,
        mongoDb
      )

    await this.rerunTransactions(tenantId, transactionIds, sqsClient)
    await this.rerunArsScores(tenantId, arsIds, sqsClient)
    await this.rerunTransactionEvents(tenantId, eventIds, sqsClient)
  }

  private async sendEntityToSQS(
    sqsClient: SQSClient,
    messages: SendEntityToSQSParams[]
  ) {
    const dynamoDbMessages: DynamoDbEntityUpdate[] = messages.map((m) => ({
      tenantId: m.tenantId,
      partitionKeyId: m.keys.PartitionKeyID,
      sortKeyId: m.keys.SortKeyID,
      entityId: m.entityId,
      NewImage: m.data,
      type: m.type,
    }))

    await bulkSendMessages(
      sqsClient,
      process.env.SECONDARY_TARPON_QUEUE_URL as string,
      dynamoDbMessages.map((m) => ({
        MessageBody: JSON.stringify(m),
        MessageGroupId: generateChecksum(m.tenantId, 10),
        MessageDeduplicationId: generateChecksum(
          JSON.stringify(m.NewImage),
          10
        ),
      }))
    )
  }

  protected async run(job: GoCardlessBackfillBatchJob): Promise<void> {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const sqsClient = new SQSClient({})
    const dynamoDb = getDynamoDbClient()

    this.dynamoDbTransactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )
    this.riskRepository = new RiskRepository(tenantId, { dynamoDb })
    this.eventsRepository = new TransactionEventRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })

    console.log(`Starting GoCardless backfill for tenant: ${tenantId}`)

    const batchSize = job.parameters.concurrency || DEFAULT_CONCURRENCY

    // Use cursor with proper timeout and error handling
    const requestLogsCollection = mongoDb
      .db()
      .collection<ApiRequestLog>(API_REQUEST_LOGS_COLLECTION(tenantId))

    const requestLogsCursor = requestLogsCollection
      .find({ path: '/transactions' })
      .sort({ timestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)

    const totalRequestsToProcess = await requestLogsCollection.countDocuments({
      path: '/transactions',
    })

    const transactionsToProcess: Transaction[] = []
    let processedCount = 0

    for await (const log of requestLogsCursor) {
      const transaction = log.payload as Transaction

      if (!transaction?.transactionId) {
        console.warn('Skipping invalid transaction from log:', {
          logId: log._id,
        })
        continue
      }

      transactionsToProcess.push(transaction)

      if (transactionsToProcess.length >= batchSize) {
        await this.processBatchTransactions(
          tenantId,
          transactionsToProcess,
          mongoDb,
          sqsClient
        )
        processedCount += transactionsToProcess.length
        console.log(
          `Processed ${processedCount} / ${totalRequestsToProcess} requests`
        )
        transactionsToProcess.length = 0
      }
    }

    if (transactionsToProcess.length > 0) {
      await this.processBatchTransactions(
        tenantId,
        transactionsToProcess,
        mongoDb,
        sqsClient
      )
      console.log(
        `Processed ${processedCount} / ${totalRequestsToProcess} requests`
      )
      processedCount += transactionsToProcess.length
    }

    console.log(`GoCardless backfill completed for tenant: ${tenantId}`, {
      totalProcessed: processedCount,
      totalTransactions: transactionsToProcess.length,
    })
  }
}
