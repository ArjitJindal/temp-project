import { SQSEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { initializeTenantContext, withContext } from '@/core/utils/context'
import { RulesEngineService } from '@/services/rules-engine'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { logger } from '@/core/logger'
import { AsyncRuleRecord } from '@/services/rules-engine/utils'
import { envIsNot } from '@/utils/env'
import { acquireLock, releaseLock } from '@/utils/lock'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'

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
  await withContext(async () => {
    await initializeTenantContext(record.tenantId)
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
      const { transaction, senderUser, receiverUser, riskDetails } = record
      logger.info(
        `Running async rule for transaction ${transaction.transactionId} for tenant ${tenantId}`
      )
      await rulesEngineService.verifyAsyncRulesTransaction(
        transaction,
        senderUser,
        receiverUser,
        riskDetails
      )
    } else if (type === 'TRANSACTION_EVENT') {
      const {
        senderUser,
        receiverUser,
        updatedTransaction,
        transactionEventId,
      } = record

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
      logger.info(
        `Running async rule for user ${record.user.userId} for tenant ${tenantId}`
      )
      await userRulesEngineService.verifyAsyncRulesUser(
        record.userType,
        record.user
      )
    } else if (type === 'USER_EVENT') {
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
      await rulesEngineService.verifyTransaction(record.transaction, {
        // Already validated. Skip validation.
        validateDestinationUserId: false,
        validateOriginUserId: false,
        validateTransactionId: false,
      })
    } else if (type === 'TRANSACTION_EVENT_BATCH') {
      await rulesEngineService.verifyTransactionEvent(record.transactionEvent)
    } else if (type === 'USER_BATCH') {
      await userRulesEngineService.verifyUser(record.user, record.userType)
    } else if (type === 'USER_EVENT_BATCH') {
      if (record.userType === 'CONSUMER') {
        await userRulesEngineService.verifyConsumerUserEvent(record.userEvent)
      } else {
        await userRulesEngineService.verifyBusinessUserEvent(record.userEvent)
      }
    }
  })
}

export const asyncRuleRunnerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const { Records } = event
    const dynamoDb = getDynamoDbClient()
    // We can do this as default group ID is tenant ID checksum so for a singe lambda invocation all messages will be from same tenant
    const tenantId = JSON.parse(Records[0].body).tenantId
    const tenantRepository = new TenantRepository(tenantId, {
      dynamoDb,
    })
    const tenantSettings = await tenantRepository.getTenantSettings()
    if (!tenantSettings.features?.includes('PNB')) {
      for await (const record of Records) {
        const sqsMessage = JSON.parse(record.body) as AsyncRuleRecord
        logger.info(`Running async rule for ${sqsMessage.tenantId}`)
        await runAsyncRules(sqsMessage)
      }
    } else {
      await Promise.all(
        Records.map(async (record) => {
          const sqsMessage = JSON.parse(record.body) as AsyncRuleRecord
          const lockKeys = getLockKeys(sqsMessage)
          if (lockKeys.length > 0 && envIsNot('test', 'local')) {
            await Promise.all(lockKeys.map((key) => acquireLock(dynamoDb, key)))
          }
          try {
            logger.info(`Running async rule for ${sqsMessage.tenantId}`)
            await runAsyncRules(sqsMessage)
          } finally {
            if (lockKeys.length > 0 && envIsNot('test', 'local')) {
              await Promise.all(
                lockKeys.map((key) => releaseLock(dynamoDb, key))
              )
            }
          }
        })
      )
    }
  }
)
