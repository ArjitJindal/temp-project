import { Filter, FindCursor, WithId } from 'mongodb'
import _ from 'lodash'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from './migration-progress'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TRANSACTIONS_COLLECTION, getMongoDbClient } from '@/utils/mongoDBUtils'
import {
  RulesEngineService,
  getExecutedAndHitRulesResult,
} from '@/services/rules-engine'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'
import { logger } from '@/core/logger'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'

const TRANSACTIONS_BATCH_SIZE = 1000

export async function migrateTransactions(
  transactionsCursor: FindCursor<WithId<InternalTransaction>>,
  processTransactions: (
    transactionsBatch: InternalTransaction[]
  ) => Promise<void>
) {
  const cursor = transactionsCursor.batchSize(TRANSACTIONS_BATCH_SIZE)
  let pendingTransactions: InternalTransaction[] = []
  for await (const transaction of cursor) {
    pendingTransactions.push(transaction)
    if (pendingTransactions.length === TRANSACTIONS_BATCH_SIZE) {
      await processTransactions(pendingTransactions)
      pendingTransactions = []
    }
  }
  if (pendingTransactions.length > 0) {
    await processTransactions(pendingTransactions)
  }
}

export async function replayTransactionsAndEvents(
  tenantId: string,
  afterTimestamp: number,
  beforeTimestamp: number,
  migrationKey: string,
  extraFilter?: Filter<InternalTransaction>
) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = (await getMongoDbClient()).db()
  const rulesEngine = new RulesEngineService(tenantId, dynamoDb)
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  // TODO: For a transaction, use the rule instance snapshot at that time instead of the latest version
  const ruleInstances = await ruleInstanceRepository.getActiveRuleInstances(
    'TRANSACTION'
  )
  const transactionRepository = new DynamoDbTransactionRepository(
    tenantId,
    dynamoDb
  )
  const transactionEventRepository = new TransactionEventRepository(tenantId, {
    dynamoDb,
  })
  const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
    migrationKey
  )
  const transactionAttributeNames = Transaction.getAttributeTypeMap().map(
    (attribute) => attribute.name
  )

  const collection = mongoDb.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenantId)
  )
  const filter = {
    timestamp: {
      $gte: lastCompletedTimestamp ?? afterTimestamp,
      $lte: beforeTimestamp,
    },
    ...extraFilter,
  }
  const totalTransactionsCount = await collection.count(filter)
  const cursor = collection.aggregate([
    {
      $match: filter,
    },
    {
      $sort: { timestamp: 1 },
    },
  ])
  let processedTransactionCount = 0

  for await (const internalTransaction of cursor) {
    const transaction = _.pick(
      internalTransaction,
      transactionAttributeNames
    ) as Transaction

    // Step 1: Get all transaction events of the transaction in ascending order
    const transactionEvents = _.sortBy(
      await transactionEventRepository.getTransactionEvents(
        transaction.transactionId
      ),
      (transactionEvent) => transactionEvent.timestamp
    )

    // Step 2: For each transaction event, construct the transaction state at that
    // time and verify the transaction and update the transaction event with rules result
    let currentTransaction = {} as Transaction
    let currentRulesResult: {
      executedRules: ExecutedRulesResult[]
      hitRules: HitRulesDetails[]
    } = { executedRules: [], hitRules: [] }
    for (const transactionEvent of transactionEvents) {
      currentTransaction = _.merge(
        {
          ...currentTransaction,
          transactionState: transactionEvent.transactionState,
        },
        transactionEvent.updatedTransactionAttributes || {}
      )
      const ruleResults = (
        await Promise.all(
          ruleInstances.map((ruleInstance) => {
            try {
              return rulesEngine.verifyTransactionForSimulation(
                currentTransaction,
                ruleInstance
              )
            } catch (e) {
              logger.error(e)
            }
          })
        )
      ).filter(Boolean) as ExecutedRulesResult[]
      currentRulesResult = getExecutedAndHitRulesResult(ruleResults)
      if (currentRulesResult.executedRules.length > 0) {
        await transactionEventRepository.saveTransactionEvent(
          transactionEvent,
          currentRulesResult
        )
      }
    }

    // Step 3: Update the transaction with the latest rules result
    if (currentRulesResult.executedRules.length > 0) {
      await transactionRepository.saveTransaction(
        transaction,
        currentRulesResult
      )
      logger.info(`Updated transaction ${transaction.transactionId}`)
    }

    processedTransactionCount += 1
    logger.info(
      `Processed transaction ${transaction.transactionId} (${processedTransactionCount} / ${totalTransactionsCount})`
    )
    await updateMigrationLastCompletedTimestamp(
      migrationKey,
      transaction.timestamp
    )
  }
}
