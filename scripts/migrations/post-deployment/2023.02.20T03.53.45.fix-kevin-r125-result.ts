import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@cdk/constants'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts'
import {
  CASES_COLLECTION,
  getMongoDbClient,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'

// R-125
const TARGET_RULE_INSTANCE_ID = '778c5016'
// Affectd time internal: 2023-02-13 - 2023-02-17
const TARGET_TIME_RANGE = { $lte: 1676592000000, $gte: 1676246400000 }

function getUpdatedTransaction(
  transaction: TransactionWithRulesResult
): TransactionWithRulesResult {
  const newExecutedRules = transaction.executedRules.map((rule) => {
    if (rule.ruleInstanceId === TARGET_RULE_INSTANCE_ID) {
      return {
        ...rule,
        ruleHit: false,
        ruleHitMeta: undefined,
      }
    }
    return rule
  })
  const newHitRules = transaction.hitRules.filter(
    (rule) => rule.ruleInstanceId !== TARGET_RULE_INSTANCE_ID
  )
  return {
    ...transaction,
    executedRules: newExecutedRules,
    hitRules: newHitRules,
  }
}

async function migrateTenant(tenant: Tenant) {
  // Only migrate for Kevin
  if (tenant.id !== 'QEO03JYKBT') {
    return
  }

  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const dashboardStatsRepository = new DashboardStatsRepository(tenant.id, {
    mongoDb,
  })

  // Incident: https://github.com/flagright/tarpon/pull/906
  // This is the "shallow-fix" to make R-125 not hit for the affected time interval.
  // The transactions with R-125 hit:
  //   - 02/01 -> 02/13: 29
  //   - 02/13 -> 02/17: 52871
  // The actual R-125 hit during the affected time interval should just be a few. We
  // sacrifice those false negatives to eliminate the many false positives.
  // We'll be able to re-run rules for past transactions properly in FDT-47790 -
  // https://www.notion.so/flagright/Rerun-rules-for-existing-transactions-for-backfixing-facf9dad03794b9aa675ddda07cecc1d?pvs=4

  // Handle transactions
  const transactionCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenant.id)
  )
  const transactionCursor = transactionCollection.find({
    'hitRules.ruleInstanceId': TARGET_RULE_INSTANCE_ID,
    timestamp: TARGET_TIME_RANGE,
  })
  const stillHitTransactionIds = new Set()
  const noHitTransactionIds = new Set()
  for await (const transaction of transactionCursor) {
    const updatedTransaction = getUpdatedTransaction(transaction)
    await transactionCollection.replaceOne(
      {
        _id: transaction._id,
      },
      {
        ...updatedTransaction,
        status: MongoDbTransactionRepository.getAggregatedRuleStatus(
          updatedTransaction.executedRules
            .filter((rule) => rule.ruleHit)
            .map((rule) => rule.ruleAction)
        ),
      },
      { upsert: true }
    )
    await dashboardStatsRepository.refreshTransactionStats(
      transaction.timestamp
    )
    if (updatedTransaction.hitRules.length > 0) {
      stillHitTransactionIds.add(transaction.transactionId)
    } else {
      noHitTransactionIds.add(transaction.transactionId)
    }
  }

  // Handle cases
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenant.id))
  const casesCursor = casesCollection.find({
    'caseTransactions.hitRules.ruleInstanceId': TARGET_RULE_INSTANCE_ID,
    'caseTransactions.timestamp': TARGET_TIME_RANGE,
  })
  for await (const targetCase of casesCursor) {
    const newCaseTransactions = targetCase.caseTransactions
      ?.filter(
        (transaction) => !noHitTransactionIds.has(transaction.transactionId)
      )
      .map(getUpdatedTransaction)
    if (!newCaseTransactions || newCaseTransactions.length === 0) {
      await casesCollection.deleteOne({
        _id: targetCase._id,
      })
    } else {
      await casesCollection.replaceOne(
        {
          _id: targetCase._id,
        },
        {
          ...targetCase,
          caseTransactions: newCaseTransactions,
          caseTransactionsIds: newCaseTransactions?.map(
            (transaction) => transaction.transactionId
          ),
        },
        { upsert: true }
      )
    }
    await dashboardStatsRepository.refreshCaseStats(targetCase.createdTimestamp)
  }

  // Handle rule hit stats
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const targetRuleInstance = await ruleInstanceRepository.getRuleInstanceById(
    TARGET_RULE_INSTANCE_ID
  )
  if (targetRuleInstance) {
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_INSTANCE(tenant.id, TARGET_RULE_INSTANCE_ID),
      UpdateExpression: `SET hitCount = hitCount - :hitCountDelta`,
      ExpressionAttributeValues: {
        ':hitCountDelta':
          stillHitTransactionIds.size + noHitTransactionIds.size,
      },
      ReturnValues: 'UPDATED_NEW',
    }
    await dynamoDb.send(new UpdateCommand(updateItemInput))
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
