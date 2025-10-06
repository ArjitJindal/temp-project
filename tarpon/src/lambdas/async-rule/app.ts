import { SQSEvent } from 'aws-lambda'
import compact from 'lodash/compact'
import groupBy from 'lodash/groupBy'
import { StackConstants } from '@lib/constants'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  hasFeature,
  initializeTenantContext,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { RulesEngineService } from '@/services/rules-engine'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { logger } from '@/core/logger'
import { sendAsyncRuleTasks } from '@/services/rules-engine/utils'
import { AsyncBatchRecord, AsyncRuleRecord } from '@/@types/batch-import'
import { envIsNot } from '@/utils/env'
import { acquireLock, releaseLock } from '@/utils/lock'
import { BatchImportService } from '@/services/batch-import'
import { getSharedOpensearchClient } from '@/utils/opensearch-utils'

function getLockKeys(record: AsyncRuleRecord): string[] {
  switch (record.type) {
    case 'TRANSACTION':
      if (record.tenantId === '4c9cdf0251') {
        return [record.senderUser?.userId, record.receiverUser?.userId].filter(
          (id): id is string => !!id
        )
      }
      return [
        record.transaction.originUserId,
        record.transaction.destinationUserId,
      ].filter((id): id is string => !!id)
    case 'TRANSACTION_EVENT':
      return [record.senderUser?.userId, record.receiverUser?.userId].filter(
        (id): id is string => !!id
      )
    case 'TRANSACTION_BATCH':
      return [
        record.transaction.originUserId,
        record.transaction.destinationUserId,
      ].filter((id): id is string => !!id)
    case 'TRANSACTION_EVENT_BATCH':
      return compact([record.originUserId, record.destinationUserId])
    case 'USER':
      return [record.user.userId]
    case 'USER_EVENT':
      return [record.updatedUser.userId]
    case 'USER_BATCH':
      return [record.user.userId]
    case 'USER_EVENT_BATCH':
      return [record.userEvent.userId]
  }
}

export const runAsyncRules = async (record: AsyncRuleRecord) => {
  const { tenantId } = record
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const opensearchClient = hasFeature('OPEN_SEARCH')
    ? await getSharedOpensearchClient()
    : undefined
  const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
  const rulesEngineService = new RulesEngineService(
    tenantId,
    dynamoDb,
    logicEvaluator,
    mongoDb,
    opensearchClient
  )
  const userRulesEngineService = new UserManagementService(
    tenantId,
    dynamoDb,
    mongoDb,
    logicEvaluator,
    opensearchClient
  )
  const { type } = record

  if (type === 'TRANSACTION') {
    const {
      transaction,
      senderUser,
      receiverUser,
      riskDetails,
      backfillNamespace,
    } = record
    updateLogMetadata({ transactionId: transaction.transactionId })
    logger.info(
      `Running async rule for transaction ${transaction.transactionId} for tenant ${tenantId}`
    )
    logicEvaluator.setBackfillNamespace(backfillNamespace)
    await rulesEngineService.verifyAsyncRulesTransaction(
      transaction,
      senderUser,
      receiverUser,
      riskDetails
    )
    logicEvaluator.setBackfillNamespace(undefined)
  } else if (type === 'TRANSACTION_EVENT') {
    const { senderUser, receiverUser, updatedTransaction, transactionEventId } =
      record
    updateLogMetadata({ transactionId: updatedTransaction.transactionId })
    logger.info(
      `Running async rule for transaction event ${transactionEventId} for tenant ${tenantId}`
    )

    await rulesEngineService.verifyAsyncRulesTransactionEvent(
      updatedTransaction,
      transactionEventId,
      senderUser,
      receiverUser
    )
  } else if (type === 'USER') {
    updateLogMetadata({ userId: record.user.userId })
    logger.info(
      `Running async rule for user ${record.user.userId} for tenant ${tenantId}`
    )
    await userRulesEngineService.verifyAsyncRulesUser(
      record.userType,
      record.user
    )
  } else if (type === 'USER_EVENT') {
    updateLogMetadata({ userId: record.updatedUser.userId })
    logger.info(
      `Running async rule for user event ${record.userEventTimestamp} for tenant ${tenantId}`
    )
    await userRulesEngineService.verifyAsyncRulesUserEvent(
      record.userType,
      record.updatedUser,
      record.userEventTimestamp
    )
  }

  // Batch import
  if (type === 'TRANSACTION_BATCH') {
    updateLogMetadata({ transactionId: record.transaction.transactionId })
    await rulesEngineService.verifyTransaction(record.transaction, {
      // Already validated. Skip validation.
      validateDestinationUserId: false,
      validateOriginUserId: false,
      validateTransactionId: false,
    })
  } else if (type === 'TRANSACTION_EVENT_BATCH') {
    updateLogMetadata({ transactionId: record.transactionEvent.transactionId })
    await rulesEngineService.verifyTransactionEvent(record.transactionEvent)
  } else if (type === 'USER_BATCH') {
    updateLogMetadata({ userId: record.user.userId })
    await userRulesEngineService.createAndVerifyUser(
      record.user,
      record.userType === 'CONSUMER',
      record.parameters
    )
  } else if (type === 'USER_EVENT_BATCH') {
    if (record.userType === 'CONSUMER') {
      updateLogMetadata({ userId: record.userEvent.userId })
      await userRulesEngineService.verifyConsumerUserEvent(
        record.userEvent,
        record.parameters?.lockCraRiskLevel,
        record.parameters?.lockKycRiskLevel
      )
    } else {
      updateLogMetadata({ userId: record.userEvent.userId })
      await userRulesEngineService.verifyBusinessUserEvent(
        record.userEvent,
        record.parameters?.lockCraRiskLevel,
        record.parameters?.lockKycRiskLevel
      )
    }
  }
}
export const asyncRuleRunnerHandler = lambdaConsumer()(
  async (event: SQSEvent & { saveBatchEntities?: boolean }) => {
    const { Records, saveBatchEntities = true } = event
    const records = Records.map((record) => ({
      messageId: record.messageId,
      body: JSON.parse(record.body) as AsyncRuleRecord,
    }))
    const tenantGroupRecords = groupBy(records, (v) => v.body.tenantId)
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    await Promise.all(
      Object.entries(tenantGroupRecords).map(async ([tenantId, records]) => {
        await withContext(async () => {
          await initializeTenantContext(tenantId)
          const isConcurrentAsyncRulesEnabled = hasFeature(
            'CONCURRENT_ASYNC_RULES'
          )
          if (
            tenantId === '4c9cdf0251' &&
            process.env.AWS_LAMBDA_FUNCTION_NAME ===
              StackConstants.ASYNC_RULE_RUNNER_FUNCTION_NAME
          ) {
            await sendAsyncRuleTasks(
              records.map((record) => record.body),
              true
            )
            logger.info(`Sent messages to secondary queue`)
            return
          }
          let batchSavingPromise: Promise<void> | undefined
          if (saveBatchEntities) {
            const batchImportService = new BatchImportService(tenantId, {
              dynamoDb,
              mongoDb,
            })
            batchSavingPromise = batchImportService.saveBatchEntities(
              records
                .map((record) => record.body as AsyncBatchRecord)
                .filter((data) => !!data.batchId)
            )
          }
          for await (const record of records) {
            const lockKeys =
              isConcurrentAsyncRulesEnabled && envIsNot('test', 'local')
                ? getLockKeys(record.body)
                : []

            // Acquire locks
            if (lockKeys.length > 0) {
              await Promise.all(
                lockKeys.map((key) =>
                  acquireLock(dynamoDb, key, {
                    startingDelay: 500,
                    maxDelay: 500,
                    ttlSeconds: 15,
                  })
                )
              )
            }

            await runAsyncRules(record.body)

            // Release locks
            if (lockKeys.length > 0) {
              await Promise.all(
                lockKeys.map((key) => releaseLock(dynamoDb, key))
              )
            }
          }
          if (batchSavingPromise) {
            await batchSavingPromise
          }
        })
      })
    )
  }
)
