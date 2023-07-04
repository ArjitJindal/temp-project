import { StackConstants } from '@lib/constants'
import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from './migration-progress'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  getMongoDbClient,
  withTransaction,
} from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'

export async function cleanupRuleHits(values: {
  ruleInstanceId: string
  tenantId: string
  impactTimestamps?: {
    start: number
    end: number
  }
  migrationKey?: string
}) {
  const { ruleInstanceId, tenantId, impactTimestamps, migrationKey } = values
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenantId)
  )

  const migrationLastCompletedTimestamp = migrationKey
    ? await getMigrationLastCompletedTimestamp(migrationKey)
    : undefined

  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))

  const transactionsResult = await transactionsCollection
    .find({
      'hitRules.ruleInstanceId': ruleInstanceId,
      createdAt: {
        $gte: migrationLastCompletedTimestamp ?? impactTimestamps?.start ?? 0,
        $lte: impactTimestamps?.end ?? Number.MAX_SAFE_INTEGER,
      },
    })
    .sort({ createdAt: 1 })

  logger.info(
    `Found ${await transactionsResult.count()} transactions for tenant ${tenantId}`
  )

  const dynamoDb = getDynamoDbClient()

  for await (const transaction of transactionsResult) {
    const hitRules = transaction.hitRules.filter(
      (hitRule) => hitRule.ruleInstanceId !== ruleInstanceId
    )

    const executedRules = transaction.executedRules.filter(
      (executedRule) => executedRule.ruleInstanceId !== ruleInstanceId
    )

    const primaryKey = DynamoDbKeys.TRANSACTION(
      tenantId,
      transaction.transactionId
    )

    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: primaryKey,
      UpdateExpression: `set #executedRules = :executedRules, #hitRules = :hitRules`,
      ExpressionAttributeNames: {
        '#executedRules': 'executedRules',
        '#hitRules': 'hitRules',
      },
      ExpressionAttributeValues: {
        ':executedRules': executedRules,
        ':hitRules': hitRules,
      },
      ReturnValues: 'ALL_NEW',
    }

    await dynamoDb.send(new UpdateCommand(updateItemInput)) // threre is no batch updateItem in dynamodb

    const cases = await casesCollection
      .find({ caseTransactionsIds: transaction.transactionId })
      .toArray() // There are maximum 2 cases possible for a transaction

    await Promise.all(
      cases.map(async (caseItem) => {
        const alerts = (caseItem.alerts ?? [])
          .map((alert) =>
            alert.ruleInstanceId === ruleInstanceId
              ? {
                  ...alert,
                  transactionIds: (alert.transactionIds ?? []).filter(
                    (transactionId) =>
                      transactionId !== transaction.transactionId
                  ),
                }
              : alert
          )
          .filter((alert) => alert.transactionIds?.length)

        const caseTransactionIds = _.compact(
          _.uniq(_.flatten(alerts.map((alert) => alert?.transactionIds)))
        )

        const caseTransactions = caseItem.caseTransactions?.filter(
          (caseTransaction) =>
            caseTransactionIds.includes(caseTransaction.transactionId)
        )

        if (!alerts.length) {
          const deleteResult = await casesCollection.deleteOne({
            _id: caseItem._id,
          })

          logger.info(
            `Deleted ${deleteResult.deletedCount} case for tenant ${tenantId}`
          )
        } else {
          const updateResult = await casesCollection.updateOne(
            { _id: caseItem._id },
            {
              $set: {
                alerts,
                caseTransactions,
                caseTransactionIds,
              },
            }
          )

          logger.info(
            `Updated ${updateResult.modifiedCount} case for tenant ${tenantId}`
          )
        }
      })
    )

    if (migrationKey) {
      await updateMigrationLastCompletedTimestamp(
        migrationKey,
        transaction.createdAt ?? transaction.timestamp
      )
    }
  }

  await withTransaction(async () => {
    const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
      mongoDb,
    })

    await dashboardStatsRepository.refreshCaseStats({
      startTimestamp: impactTimestamps?.start,
      endTimestamp: impactTimestamps?.end,
    })

    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    await ruleInstanceRepository.updateRuleInstanceStatsCount(
      [ruleInstanceId],
      [ruleInstanceId],
      { hitCountStep: -(await transactionsResult.count()), runCountStep: 0 }
    )
  })
}
