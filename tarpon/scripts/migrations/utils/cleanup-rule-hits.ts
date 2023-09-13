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
import { sendBatchJobCommand } from '@/services/batch-job'

const TRANSACTIONS_PROCESS_BATCH_SIZE = 10

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
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()
  const transactionsCollection = db.collection<InternalTransaction>(
    TRANSACTIONS_COLLECTION(tenantId)
  )
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const migrationLastCompletedTimestamp = migrationKey
    ? await getMigrationLastCompletedTimestamp(migrationKey)
    : undefined

  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))

  const impactTimestampsStart =
    migrationLastCompletedTimestamp ?? impactTimestamps?.start ?? 0
  const cursor = await transactionsCollection
    .find({
      'hitRules.ruleInstanceId': ruleInstanceId,
      createdAt: {
        $gte: impactTimestampsStart,
        $lte: impactTimestamps?.end ?? Number.MAX_SAFE_INTEGER,
      },
    })
    .sort({ createdAt: 1 })
    .allowDiskUse()

  const totalTransactions = await cursor.count()
  logger.info(`Found ${totalTransactions} transactions for tenant ${tenantId}`)

  let startTimetsamp = impactTimestampsStart
  let migratedTransactionsCount = 0
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

      // Refresh dashboard
      migratedTransactionsCount += TRANSACTIONS_PROCESS_BATCH_SIZE
      if (
        migratedTransactionsCount % 1000 === 0 ||
        transactions.length < TRANSACTIONS_PROCESS_BATCH_SIZE
      ) {
        const timeRange = {
          startTimestamp: startTimetsamp,
          endTimestamp: lastTransaction?.createdAt,
        }
        await sendBatchJobCommand({
          type: 'DASHBOARD_REFRESH',
          tenantId,
          parameters: {
            cases: timeRange,
            transactions: timeRange,
          },
        })
        startTimetsamp = (lastTransaction?.createdAt ??
          lastTransaction?.timestamp) as number
        logger.info(`Refreshed dashboard`)
      }
    },
    { processBatchSize: TRANSACTIONS_PROCESS_BATCH_SIZE }
  )
}
