import { MongoClient } from 'mongodb'
import pMap from 'p-map'
import { isConsumerUser } from '../rules-engine/utils/user-rule-utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { GoCardlessBackfillBatchJob } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  API_REQUEST_LOGS_COLLECTION,
  ARS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
  KRS_SCORES_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USER_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { ApiRequestLog } from '@/@types/request-logger'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

const DEFAULT_CONCURRENCY = 1000

export class GoCardlessBackfillBatchJobRunner extends BatchJobRunner {
  /**
   * Validates transactions and returns IDs that need to be rerun
   */
  private async validateTransactions(
    tenantId: string,
    transactionIds: string[],
    mongoDb: MongoClient
  ): Promise<string[]> {
    if (transactionIds.length === 0) {
      return []
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
    const transactionIdSet = new Set(transactions.map((t) => t.transactionId))
    const eventsIdSet = new Set(transactionEvents.map((e) => e.transactionId))
    const arsScoresIdSet = new Set(arsScores.map((s) => s.transactionId))

    const transactionIdsToRerun = new Set<string>()

    // Single pass through transactionIds to find all issues
    for (const id of transactionIds) {
      if (
        !transactionIdSet.has(id) ||
        !eventsIdSet.has(id) ||
        !arsScoresIdSet.has(id)
      ) {
        transactionIdsToRerun.add(id)
      }
    }

    // Check for transactions without timestamp
    for (const transaction of transactions) {
      if (transaction.timestamp == null) {
        transactionIdsToRerun.add(transaction.transactionId)
      }
    }

    return Array.from(transactionIdsToRerun)
  }

  private async validateUsers(
    tenantId: string,
    userIds: string[],
    mongoDb: MongoClient
  ): Promise<string[]> {
    if (userIds.length === 0) {
      return []
    }

    const db = mongoDb.db()

    const [users, userEvents, drs, krs] = await Promise.all([
      db
        .collection<User | Business>(USERS_COLLECTION(tenantId))
        .find(
          { userId: { $in: userIds } },
          { projection: { userId: 1, createdTimestamp: 1 } }
        )
        .toArray(),
      db
        .collection<ConsumerUserEvent | BusinessUserEvent>(
          USER_EVENTS_COLLECTION(tenantId)
        )
        .find({ userId: { $in: userIds } }, { projection: { userId: 1 } })
        .toArray(),
      db
        .collection<DrsScore>(DRS_SCORES_COLLECTION(tenantId))
        .find({ userId: { $in: userIds } }, { projection: { userId: 1 } })
        .toArray(),
      db
        .collection<KrsScore>(KRS_SCORES_COLLECTION(tenantId))
        .find({ userId: { $in: userIds } }, { projection: { userId: 1 } })
        .toArray(),
    ])

    const usersSet = new Set(users.map((u) => u.userId))
    const userEventsSet = new Set(userEvents.map((e) => e.userId))
    const drsSet = new Set(drs.map((d) => d.userId))
    const krsSet = new Set(krs.map((k) => k.userId))

    const userIdsToRerun = new Set<string>()

    for (const userId of userIds) {
      if (
        !usersSet.has(userId) ||
        !userEventsSet.has(userId) ||
        !drsSet.has(userId) ||
        !krsSet.has(userId)
      ) {
        userIdsToRerun.add(userId)
      }
    }

    for (const user of users) {
      if (user.createdTimestamp == null) {
        userIdsToRerun.add(user.userId)
      }
    }

    return Array.from(userIdsToRerun)
  }

  /**
   * Reruns transactions with improved error handling and retry logic
   */
  private async rerunTransactions(
    publicApiEndpoint: string,
    apiKey: string,
    transactions: Transaction[]
  ): Promise<void> {
    if (transactions.length === 0) {
      return
    }

    const baseUrl = `https://${publicApiEndpoint}/transactions?validateTransactionId=false`
    const headers = {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    }

    // Process transactions with concurrency control and error handling
    await pMap(
      transactions,
      async (transaction, index) => {
        try {
          await fetch(baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(transaction),
          })
        } catch (error) {
          console.error(
            `Failed to rerun transaction ${transaction.transactionId} (index ${index}):`,
            {
              error: error instanceof Error ? error.message : 'Unknown error',
              transactionId: transaction.transactionId,
            }
          )
          // Re-throw to stop processing if needed, or handle gracefully
          throw error
        }
      },
      { concurrency: 100 }
    )
  }

  /**
   * Processes a batch of transactions efficiently
   */
  private async processBatchTransactions(
    tenantId: string,
    batch: Transaction[],
    job: GoCardlessBackfillBatchJob,
    mongoDb: MongoClient
  ): Promise<void> {
    if (batch.length === 0) {
      return
    }

    const transactionIds = batch.map((t) => t.transactionId)
    const validationResult = await this.validateTransactions(
      tenantId,
      transactionIds,
      mongoDb
    )

    if (validationResult.length > 0) {
      console.log(
        `Processing batch: ${batch.length} transactions, ${validationResult.length} need rerun`,
        { transactionIdsToRerun: validationResult }
      )

      const transactionsToRerun = batch.filter((t) =>
        validationResult.includes(t.transactionId)
      )

      await this.rerunTransactions(
        job.parameters.publicApiEndpoint,
        job.parameters.apiKey,
        transactionsToRerun
      )
    }
  }

  private async processBatchUsers(
    tenantId: string,
    batch: (User | Business)[],
    job: GoCardlessBackfillBatchJob,
    mongoDb: MongoClient
  ): Promise<void> {
    if (batch.length === 0) {
      return
    }

    const userIds = batch.map((u) => u.userId)
    const validationResult = await this.validateUsers(
      tenantId,
      userIds,
      mongoDb
    )

    if (validationResult.length > 0) {
      console.log(
        `Processing batch: ${batch.length} users, ${validationResult.length} need rerun`,
        { userIdsToRerun: validationResult }
      )

      const usersToRerun = batch.filter((u) =>
        validationResult.includes(u.userId)
      )

      await this.rerunUsers(
        job.parameters.publicApiEndpoint,
        job.parameters.apiKey,
        usersToRerun
      )
    }
  }

  private async rerunUsers(
    publicApiEndpoint: string,
    apiKey: string,
    users: (User | Business)[]
  ): Promise<void> {
    if (users.length === 0) {
      return
    }

    await pMap(
      users,
      async (user) => {
        const userType = isConsumerUser(user) ? 'consumer' : 'business'
        const baseUrl = `https://${publicApiEndpoint}/${userType}/users?validateUserId=false`
        const headers = {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        }

        await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(user),
        })
      },
      { concurrency: 100 }
    )
  }

  protected async run(job: GoCardlessBackfillBatchJob): Promise<void> {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()

    console.log(`Starting GoCardless backfill for tenant: ${tenantId}`)

    const batchSize = job.parameters.concurrency || DEFAULT_CONCURRENCY

    // Use cursor with proper timeout and error handling
    const requestLogsCollection = mongoDb
      .db()
      .collection<ApiRequestLog>(API_REQUEST_LOGS_COLLECTION(tenantId))

    const usersRequestLogsCursor = requestLogsCollection
      .find({ path: '/users' })
      .sort({ timestamp: 1 })
      .addCursorFlag('noCursorTimeout', true)

    const totalUsersToProcess = await requestLogsCollection.countDocuments({
      path: {
        $in: ['/consumer/users', '/business/users'],
      },
    })

    const usersToProcess: (User | Business)[] = []
    let usersProcessedCount = 0

    for await (const log of usersRequestLogsCursor) {
      const user = log.payload as User | Business
      usersToProcess.push(user)

      if (usersToProcess.length >= batchSize) {
        await this.processBatchUsers(tenantId, usersToProcess, job, mongoDb)
        usersProcessedCount += usersToProcess.length
        console.log(
          `Processed ${usersProcessedCount} / ${totalUsersToProcess} requests`
        )
        usersToProcess.length = 0
      }
    }

    if (usersToProcess.length > 0) {
      await this.processBatchUsers(tenantId, usersToProcess, job, mongoDb)
      usersProcessedCount += usersToProcess.length
      console.log(
        `Processed ${usersProcessedCount} / ${totalUsersToProcess} requests`
      )
    }

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
          job,
          mongoDb
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
        job,
        mongoDb
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
