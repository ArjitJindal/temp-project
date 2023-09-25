import { StackConstants } from '@lib/constants'
import { UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'

import { compact, flatten, last, uniq } from 'lodash'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from './migration-progress'
import { migrateEntities } from './mongodb'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'

const TRANSACTIONS_PROCESS_BATCH_SIZE = 20

type Props = {
  ruleInstanceId: string
  tenantId: string
  impactTimestamps?: {
    start: number
    end: number
  }
  migrationKey?: string
}

export async function cleanupRuleHits(values: Props) {
  for (let i = 0; i < 100; i++) {
    try {
      await cleanupRuleHitsInternal(values)
      return
    } catch (e) {
      if (!/cursor id \d+ not found/.test((e as Error)?.message)) {
        throw e
      }
      logger.error(e)
      logger.error('Retry..')
    }
  }
}

async function cleanupRuleHitsInternal(values: Props) {
  const { ruleInstanceId, tenantId, impactTimestamps, migrationKey } = values
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenantId)
  )
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const dashboardStatsRepository = new DashboardStatsRepository(tenantId, {
    mongoDb,
  })
  const migrationLastCompletedTimestamp = migrationKey
    ? await getMigrationLastCompletedTimestamp(migrationKey)
    : undefined
  const impactTimestampsStart =
    migrationLastCompletedTimestamp ?? impactTimestamps?.start ?? 0
  const cursor = await transactionsCollection
    .find(
      {
        'hitRules.ruleInstanceId': ruleInstanceId,
        createdAt: {
          $gte: impactTimestampsStart,
          $lte: impactTimestamps?.end ?? Number.MAX_SAFE_INTEGER,
        },
      },
      { timeout: false }
    )
    .sort({ createdAt: 1 })
    .allowDiskUse()

  logger.info(
    `Found ${await cursor.count()} transactions for tenant ${tenantId}`
  )

  await migrateEntities<InternalTransaction>(
    cursor,
    async (transactions) => {
      await Promise.all(
        transactions.map(async (transaction) => {
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

          const updateItemInput: UpdateCommandInput = {
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

              const caseTransactionIds = compact(
                uniq(flatten(alerts.map((alert) => alert?.transactionIds)))
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
        })
      )

      // Update rule stat
      await ruleInstanceRepository.updateRuleInstanceStatsCount(
        [ruleInstanceId],
        [ruleInstanceId],
        { hitCountStep: -transactions.length, runCountStep: 0 }
      )
      logger.info(`Updated rule hit count`)

      // Updtate migration progress
      const lastTransaction = last(transactions)
      if (migrationKey) {
        if (lastTransaction) {
          await updateMigrationLastCompletedTimestamp(
            migrationKey,
            lastTransaction.createdAt ?? lastTransaction.timestamp
          )
        }
      }
    },
    { mongoBatchSize: 100, processBatchSize: TRANSACTIONS_PROCESS_BATCH_SIZE }
  )

  await dashboardStatsRepository.refreshAllStats({
    startTimestamp: impactTimestampsStart,
    endTimestamp: impactTimestamps?.end ?? Number.MAX_SAFE_INTEGER,
  })
}
