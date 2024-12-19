import { last, memoize } from 'lodash'
import pMap from 'p-map'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { StackConstants } from '@lib/constants'
import { SQSBatchItemFailure } from 'aws-lambda'
import { MongoClient } from 'mongodb'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { AsyncRuleRecord } from '../rules-engine/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { BackfillAsyncRuleRuns } from '@/@types/batch-job'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { pickKnownEntityFields } from '@/utils/object'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { acquireInMemoryLocks } from '@/utils/lock'
import { logger } from '@/core/logger'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Business } from '@/@types/openapi-internal/Business'
import { User } from '@/@types/openapi-public/User'

const lambdaClient = new LambdaClient()

export class BackfillAsyncRuleRunsBatchJobRunner extends BatchJobRunner {
  private tenantId!: string
  private startTimestamp?: number
  private concurrency!: number
  private mongoDb!: MongoClient
  private type!: 'RERUN' | 'NOT_RUN'

  protected async run(
    job: BackfillAsyncRuleRuns & { jobId: string }
  ): Promise<void> {
    const { tenantId, parameters } = job
    const { concurrency, startTimestamp, type, affectedExecutionRange } =
      parameters

    this.tenantId = tenantId
    this.startTimestamp = startTimestamp
    this.concurrency = concurrency
    this.type = type

    const lastCompletedTimestamp =
      (await getMigrationLastCompletedTimestamp(this.jobId)) ?? 0
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleInstances = await ruleInstanceRepository.getActiveRuleInstances()
    const activeTxAsyncRuleIds = ruleInstances
      .filter(
        (v) => v.type === 'TRANSACTION' && v.ruleExecutionMode === 'ASYNC'
      )
      .map((v) => v.id as string)
    if (activeTxAsyncRuleIds.length > 0) {
      await this.backfillTxAsyncRuleRuns(
        activeTxAsyncRuleIds,
        lastCompletedTimestamp,
        affectedExecutionRange
      )
      return
    }
  }

  private async backfillTxAsyncRuleRuns(
    asyncRuleInstanceIds: string[],
    lastCompletedTimestamp: number,
    affectedExecutionRange?: {
      start: number
      end: number
    }
  ): Promise<void> {
    this.mongoDb = await getMongoDbClient()
    const db = this.mongoDb.db()
    const collection = db.collection(TRANSACTIONS_COLLECTION(this.tenantId))
    const executedRules =
      this.type === 'RERUN'
        ? {
            $elemMatch: {
              $and: [
                { ruleInstanceId: { $in: asyncRuleInstanceIds } },
                ...(affectedExecutionRange
                  ? [
                      {
                        executedAt: {
                          $gte: affectedExecutionRange.start,
                          $lte: affectedExecutionRange.end,
                        },
                      },
                    ]
                  : []),
              ],
            },
          }
        : {
            $not: {
              $elemMatch: { ruleInstanceId: { $in: asyncRuleInstanceIds } },
            },
          }
    const match = {
      createdAt: {
        $gte: Math.max(this.startTimestamp ?? 0, lastCompletedTimestamp),
      },
      executedRules,
    }

    const pendingTransactions = await collection
      .find<InternalTransaction>(match)
      .limit(1)
      .toArray()
    if (pendingTransactions.length === 0) {
      return
    }

    const targetTransactions = collection
      .find<InternalTransaction>(match)
      .sort({ timestamp: 1 })

    let batchTransactions: InternalTransaction[] = []
    let count = 0
    for await (const transaction of targetTransactions) {
      batchTransactions.push(transaction)
      count++
      if (batchTransactions.length >= 1000) {
        await this.processBatchTransactions(batchTransactions)
        batchTransactions = []
      }
    }
    if (batchTransactions.length > 0) {
      await this.processBatchTransactions(batchTransactions)
    }
    logger.warn(`Processed total ${count} transactions`)
  }

  private async processBatchTransactions(
    transactions: InternalTransaction[]
  ): Promise<void> {
    await pMap(
      transactions,
      async (transaction) => {
        await this.processTransaction(transaction)
      },
      {
        concurrency: this.concurrency,
      }
    )
    const progress = last(transactions)?.createdAt
    if (progress) {
      await updateMigrationLastCompletedTimestamp(this.jobId, progress)
    }
    logger.warn(`Processed ${transactions.length} transactions`)
  }

  private async processTransaction(
    internalTransaction: InternalTransaction
  ): Promise<void> {
    const transaction = pickKnownEntityFields(internalTransaction, Transaction)
    const releaseLocks = await acquireInMemoryLocks([
      transaction.originUserId,
      transaction.destinationUserId,
    ])
    const [originUser, destinationUser] = await Promise.all([
      this.userLoader(transaction.originUserId),
      this.userLoader(transaction.destinationUserId),
    ])
    const payload: AsyncRuleRecord = {
      tenantId: this.tenantId,
      type: 'TRANSACTION',
      transaction,
      senderUser: originUser as User | Business | undefined,
      receiverUser: destinationUser as User | Business | undefined,
      isBackfill: true,
    }
    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: StackConstants.ASYNC_RULE_RUNNER_FUNCTION_NAME,
        Payload: JSON.stringify({
          Records: [
            {
              body: JSON.stringify(payload),
            },
          ],
        }),
      })
    )
    const decodedPayload = new TextDecoder().decode(
      response.Payload
    ) as unknown as {
      batchItemFailures: SQSBatchItemFailure[]
    }
    if (decodedPayload?.batchItemFailures?.length > 0) {
      throw new Error(
        `Error processing transaction ${transaction.transactionId}`
      )
    }
    releaseLocks()
  }
  private userLoader = memoize(
    async (userId: string | undefined): Promise<InternalUser | null> => {
      if (!userId) {
        return null
      }
      const userRepository = new UserRepository(this.tenantId, {
        mongoDb: this.mongoDb,
      })
      return await userRepository.getMongoUser(userId)
    },
    (userId: string | undefined) => userId ?? ''
  )
}
