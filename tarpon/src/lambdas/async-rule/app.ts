import { SQSEvent } from 'aws-lambda'
import { groupBy } from 'lodash'
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
import { AsyncRuleRecord } from '@/services/rules-engine/utils'
import { envIsNot } from '@/utils/env'
import { acquireLock, releaseLock } from '@/utils/lock'

function getLockKeys(record: AsyncRuleRecord): string[] {
  switch (record.type) {
    case 'TRANSACTION':
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
      // TODO: To improve this
      return [record.tenantId]
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
  const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
  const rulesEngineService = new RulesEngineService(
    tenantId,
    dynamoDb,
    logicEvaluator,
    mongoDb
  )
  const userRulesEngineService = new UserManagementService(
    tenantId,
    dynamoDb,
    mongoDb,
    logicEvaluator
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
    await userRulesEngineService.verifyUser(record.user, record.userType)
  } else if (type === 'USER_EVENT_BATCH') {
    if (record.userType === 'CONSUMER') {
      updateLogMetadata({ userId: record.userEvent.userId })
      await userRulesEngineService.verifyConsumerUserEvent(record.userEvent)
    } else {
      updateLogMetadata({ userId: record.userEvent.userId })
      await userRulesEngineService.verifyBusinessUserEvent(record.userEvent)
    }
  }
}

export const asyncRuleRunnerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const { Records } = event

    const records = Records.map((record) => ({
      messageId: record.messageId,
      body: JSON.parse(record.body) as AsyncRuleRecord,
    }))
    const tenantGroupRecords = groupBy(records, (v) => v.body.tenantId)
    const dynamoDb = getDynamoDbClient()

    await Promise.all(
      Object.entries(tenantGroupRecords).map(async ([tenantId, records]) => {
        await withContext(async () => {
          await initializeTenantContext(tenantId)
          const isConcurrentAsyncRulesEnabled = hasFeature(
            'CONCURRENT_ASYNC_RULES'
          )
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
        })
      })
    )
  }
)
