import { last, memoize } from 'lodash'
import pMap from 'p-map'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { StackConstants } from '@lib/constants'
import { SQSBatchItemFailure } from 'aws-lambda'
import { MongoClient } from 'mongodb'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { UserRepository } from '../users/repositories/user-repository'
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

const lambdaClient = new LambdaClient()

const FIRST_RUNTIMSTAMPS = {
  // Taken from first run logs
  start: 1732823070692,
  end: 1732830723777,
}
const SECOND_RUNTIMSTAMPS = {
  // Taken from second run logs
  start: 1733133446585,
  end: 1733137749632,
}

export class BackfillAsyncRuleRunsBatchJobRunner extends BatchJobRunner {
  private tenantId!: string
  private startTimestamp?: number
  private concurrency!: number
  private mongoDb!: MongoClient
  protected async run(
    job: BackfillAsyncRuleRuns & { jobId: string }
  ): Promise<void> {
    const { tenantId, parameters } = job
    const { concurrency, startTimestamp, type } = parameters

    this.tenantId = tenantId
    this.startTimestamp = startTimestamp
    this.concurrency = concurrency

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
    if (type === 'TRANSACTION' && activeTxAsyncRuleIds.length > 0) {
      await this.backfillTxAsyncRuleRuns(
        activeTxAsyncRuleIds,
        lastCompletedTimestamp
      )
      return
    }
  }

  private async backfillTxAsyncRuleRuns(
    asyncRuleInstanceIds: string[],
    lastCompletedTimestamp: number
  ): Promise<void> {
    this.mongoDb = await getMongoDbClient()
    const db = this.mongoDb.db()
    const collection = db.collection(TRANSACTIONS_COLLECTION(this.tenantId))
    const match = {
      createdAt: {
        $gte: Math.max(this.startTimestamp ?? 0, lastCompletedTimestamp),
      },
      executedRules: {
        $elemMatch: {
          $and: [
            { ruleInstanceId: { $in: asyncRuleInstanceIds } },
            {
              $or: [
                {
                  executedAt: {
                    $gte: FIRST_RUNTIMSTAMPS.start,
                    $lte: FIRST_RUNTIMSTAMPS.end,
                  },
                },
                {
                  executedAt: {
                    $gte: SECOND_RUNTIMSTAMPS.start,
                    $lte: SECOND_RUNTIMSTAMPS.end,
                  },
                },
              ],
            },
          ],
        },
      },
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
      .sort({ createdAt: 1 })

    let batchTransactions: InternalTransaction[] = []
    let count = 0
    for await (const transaction of targetTransactions) {
      batchTransactions.push(transaction)
      count++
      if (batchTransactions.length >= 10000) {
        await this.processBatchTransactions(batchTransactions)
        batchTransactions = []
      }
    }
    if (batchTransactions.length > 0) {
      await this.processBatchTransactions(batchTransactions)
    }
    logger.warn(`Processed total ${count} transactions`)
    throw new Error('To be retried')
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
    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: StackConstants.ASYNC_RULE_RUNNER_FUNCTION_NAME,
        Payload: JSON.stringify({
          Records: [
            {
              body: JSON.stringify({
                tenantId: this.tenantId,
                type: 'TRANSACTION',
                transaction,
                originUser,
                destinationUser,
              }),
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
