import { last } from 'lodash'
import pMap from 'p-map'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { StackConstants } from '@lib/constants'
import { SQSBatchItemFailure } from 'aws-lambda'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { isOngoingUserRuleInstance } from '../rules-engine/utils/user-rule-utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { BackfillAsyncRuleRuns } from '@/@types/batch-job'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '@/utils/migration-progress'
import { pickKnownEntityFields } from '@/utils/object'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { acquireInMemoryLocks } from '@/utils/lock'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { logger } from '@/core/logger'
import { tenantHasFeature } from '@/core/utils/context'

const lambdaClient = new LambdaClient()

export class BackfillAsyncRuleRunsBatchJobRunner extends BatchJobRunner {
  private tenantId!: string
  private startTimestamp?: number
  private concurrency!: number

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
    const isRiskLevelsEnabled = await tenantHasFeature(tenantId, 'RISK_LEVELS')
    const ruleInstances = await ruleInstanceRepository.getActiveRuleInstances()
    const activeTxAsyncRuleIds = ruleInstances
      .filter(
        (v) => v.type === 'TRANSACTION' && v.ruleExecutionMode === 'ASYNC'
      )
      .map((v) => v.id as string)
    const activeUserAsyncRuleIds = ruleInstances
      .filter(
        (v) =>
          v.type === 'USER' &&
          v.ruleExecutionMode === 'ASYNC' &&
          !isOngoingUserRuleInstance(v, isRiskLevelsEnabled)
      )
      .map((v) => v.id as string)
    if (type === 'TRANSACTION' && activeTxAsyncRuleIds.length > 0) {
      await this.backfillTxAsyncRuleRuns(
        activeTxAsyncRuleIds,
        lastCompletedTimestamp
      )
      return
    }
    if (type === 'USER' && activeUserAsyncRuleIds.length > 0) {
      await this.backfillUserAsyncRuleRuns(
        activeUserAsyncRuleIds,
        lastCompletedTimestamp
      )
      return
    }
  }

  private async backfillTxAsyncRuleRuns(
    asyncRuleInstanceIds: string[],
    lastCompletedTimestamp: number
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const collection = db.collection(TRANSACTIONS_COLLECTION(this.tenantId))
    const match = {
      createdAt: {
        $gte: Math.max(this.startTimestamp ?? 0, lastCompletedTimestamp),
      },
      executedRules: {
        $not: {
          $elemMatch: { ruleInstanceId: { $in: asyncRuleInstanceIds } },
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

  private async backfillUserAsyncRuleRuns(
    asyncRuleInstanceIds: string[],
    lastCompletedTimestamp: number
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const collection = db.collection(USERS_COLLECTION(this.tenantId))
    const match = {
      createdAt: {
        $gte: Math.max(this.startTimestamp ?? 0, lastCompletedTimestamp),
      },
      executedRules: {
        $not: {
          $elemMatch: { ruleInstanceId: { $in: asyncRuleInstanceIds } },
        },
      },
    }
    const pendingUsers = await collection.find(match).limit(1).toArray()
    if (pendingUsers.length === 0) {
      return
    }
    const targetUsers = collection
      .find<InternalUser | InternalBusinessUser>(match)
      .sort({ createdAt: 1 })

    let batchUsers: (InternalUser | InternalBusinessUser)[] = []
    let count = 0
    for await (const user of targetUsers) {
      batchUsers.push(user)
      count++
      if (batchUsers.length >= 10000) {
        await this.processBatchUsers(batchUsers)
        batchUsers = []
      }
    }
    if (batchUsers.length > 0) {
      await this.processBatchUsers(batchUsers)
    }
    logger.warn(`Processed total ${count} users`)
    throw new Error('To be retried')
  }

  private async processBatchUsers(
    users: (InternalUser | InternalBusinessUser)[]
  ): Promise<void> {
    await pMap(
      users,
      async (user) => {
        await this.processUser(user)
      },
      {
        concurrency: this.concurrency,
      }
    )
    const progress = last(users)?.createdAt
    if (progress) {
      await updateMigrationLastCompletedTimestamp(this.jobId, progress)
    }
    logger.warn(`Processed ${users.length} users`)
  }

  private async processUser(
    internalUser: InternalUser | InternalBusinessUser
  ): Promise<void> {
    const user =
      internalUser.type === 'BUSINESS'
        ? pickKnownEntityFields(internalUser, Business)
        : pickKnownEntityFields(internalUser, User)
    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: StackConstants.ASYNC_RULE_RUNNER_FUNCTION_NAME,
        Payload: JSON.stringify({
          Records: [
            JSON.stringify({
              type: 'USER',
              userType: internalUser.type,
              user,
            }),
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
      throw new Error(`Error processing user ${user.userId}`)
    }
  }
}
