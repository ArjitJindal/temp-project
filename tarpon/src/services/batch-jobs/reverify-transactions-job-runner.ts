import isEqual from 'lodash/isEqual'
import pick from 'lodash/pick'
import sortBy from 'lodash/sortBy'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongo-table-names'
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
import { hydrateTransactionEvents } from '@/services/rules-engine/utils/transaction-rule-utils'

import { ReverifyTransactionsBatchJob } from '@/@types/batch-job'
import { TransientRepository } from '@/core/repositories/transient-repository'
import { generateChecksum } from '@/utils/object'

type RulesResult = {
  executedRules: ExecutedRulesResult[]
  hitRules: HitRulesDetails[]
}

function areRulesResultsEqual(a: RulesResult, b: RulesResult): boolean {
  return (
    isEqual(
      sortBy(a.executedRules, 'ruleInstanceId'),
      sortBy(b.executedRules, 'ruleInstanceId')
    ) &&
    isEqual(
      sortBy(a.hitRules, 'ruleInstanceId'),
      sortBy(b.hitRules, 'ruleInstanceId')
    )
  )
}

function getNewRulesResult(
  rerunRules: RulesResult,
  existingRulesResult: RulesResult
) {
  const rerunExecutedRuleInstanceIds = rerunRules.executedRules.map(
    (r) => r.ruleInstanceId
  )
  const rerunHitRuleInstanceIds = rerunRules.hitRules.map(
    (r) => r.ruleInstanceId
  )
  const newExecutedRules = existingRulesResult.executedRules
    .filter((r) => !rerunExecutedRuleInstanceIds.includes(r.ruleInstanceId))
    .concat(rerunRules.executedRules)
  const newHitRules = existingRulesResult.hitRules
    .filter((r) => !rerunHitRuleInstanceIds.includes(r.ruleInstanceId))
    .concat(rerunRules.hitRules)
  return {
    executedRules: newExecutedRules,
    hitRules: newHitRules,
  }
}

export class ReverifyTransactionsBatchJobRunner extends BatchJobRunner {
  protected async run(job: ReverifyTransactionsBatchJob): Promise<void> {
    const { tenantId, parameters } = job

    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const rulesEngine = new RulesEngineService(
      tenantId,
      dynamoDb,
      logicEvaluator,
      mongoDb
    )
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleInstances = await ruleInstanceRepository.getRuleInstancesByIds(
      parameters.ruleInstanceIds
    )
    const transactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )
    const transactionEventRepository = new TransactionEventRepository(
      tenantId,
      {
        dynamoDb,
      }
    )
    const dynamodb = getDynamoDbClient()
    const transientRepository = new TransientRepository<{
      timestamp: number
      transactionCount: number
    }>(dynamodb)
    const progressKey = `${tenantId}-${generateChecksum(parameters, 5)}`
    const progress = await transientRepository.get(
      're-verify-transactions',
      progressKey
    )
    const transactionAttributeNames = Transaction.getAttributeTypeMap().map(
      (attribute) => attribute.name
    )

    // Get the target transactions from MongoDB
    const txCollection = mongoDb
      .db()
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
    const filter = {
      createdAt: {
        $gte: progress?.timestamp ?? parameters.afterTimestamp,
        $lte: parameters.beforeTimestamp,
      },
      ...parameters.extraFilter,
    }
    const totalTransactionsCount = await txCollection.countDocuments(filter)
    const cursor = txCollection
      .find(filter)
      .sort({ createdAt: 1 })
      .addCursorFlag('noCursorTimeout', true)
    let processedTransactionCount = 0

    for await (const internalTransaction of cursor) {
      const transaction = pick(
        internalTransaction,
        transactionAttributeNames
      ) as Transaction

      // Step 1: Get all transaction events of the transaction in ascending order
      const transactionEvents = sortBy(
        await transactionEventRepository.getTransactionEvents(
          transaction.transactionId
        ),
        (transactionEvent) => transactionEvent.timestamp
      )

      // Step 2: For each transaction event, construct the transaction state at that
      // time and verify the transaction and update the transaction event with rules result
      let currentRulesResult: RulesResult = { executedRules: [], hitRules: [] }
      let updatedEventsCount = 0
      for (const txEventInfo of hydrateTransactionEvents(transactionEvents)) {
        const ruleResults = (
          await Promise.all(
            ruleInstances.map((ruleInstance) => {
              try {
                return rulesEngine.verifyTransactionForSimulation(
                  txEventInfo.transaction,
                  ruleInstance,
                  updatedEventsCount == 0 ? 'INITIAL' : 'UPDATE'
                )
              } catch (e) {
                logger.error(e)
              }
            })
          )
        ).filter(Boolean) as ExecutedRulesResult[]
        currentRulesResult = getExecutedAndHitRulesResult(ruleResults)
        const existingRulesResult = {
          executedRules: txEventInfo.transactionEvent.executedRules ?? [],
          hitRules: txEventInfo.transactionEvent.hitRules ?? [],
        }
        const newRulesResult = getNewRulesResult(
          currentRulesResult,
          existingRulesResult
        )
        if (!areRulesResultsEqual(existingRulesResult, newRulesResult)) {
          updatedEventsCount += 1
          await transactionEventRepository.saveTransactionEvent(
            txEventInfo.transactionEvent,
            newRulesResult
          )
        }
      }

      // Step 3: Update the transaction with the latest rules result
      const existingRulesResult = {
        executedRules: internalTransaction.executedRules ?? [],
        hitRules: internalTransaction.hitRules ?? [],
      }
      const newRulesResult = getNewRulesResult(
        currentRulesResult,
        existingRulesResult
      )
      let isTransactionUpdated = false
      if (!areRulesResultsEqual(existingRulesResult, newRulesResult)) {
        await transactionRepository.saveTransaction(transaction, newRulesResult)
        isTransactionUpdated = true
      }

      processedTransactionCount += 1
      logger.debug(
        `Processed tx ${transaction.transactionId} (tx updated: ${isTransactionUpdated}, events updated: ${updatedEventsCount}) (${processedTransactionCount} / ${totalTransactionsCount})`
      )

      if (processedTransactionCount % 100 === 0) {
        await transientRepository.add('re-verify-transactions', progressKey, {
          timestamp: internalTransaction.createdAt ?? 0,
          transactionCount: processedTransactionCount,
        })
      }
    }
  }
}
