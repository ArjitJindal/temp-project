import { SQSEvent } from 'aws-lambda'
import { compact } from 'lodash'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
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
import { acquireInMemoryLocks, clearInMemoryLocks } from '@/utils/lock'

export const runAsyncRules = async (record: AsyncRuleRecord) => {
  const { tenantId } = record
  await withContext(async () => {
    await initializeTenantContext(record.tenantId)
    updateLogMetadata({ type: record.type })

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

    /* Transaction */
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
    } else if (type === 'TRANSACTION_BATCH') {
      await rulesEngineService.verifyTransaction(record.transaction, {
        // Already validated. Skip validation.
        validateDestinationUserId: false,
        validateOriginUserId: false,
        validateTransactionId: false,
      })
    } else if (type === 'TRANSACTION_EVENT_BATCH') {
      await rulesEngineService.verifyTransactionEvent(record.transactionEvent)
    }

    /* User */
    if (type === 'USER') {
      await userRulesEngineService.verifyAsyncRulesUser(
        record.userType,
        record.user
      )
    } else if (type === 'USER_EVENT') {
      await userRulesEngineService.verifyAsyncRulesUserEvent(
        record.userType,
        record.updatedUser,
        record.userEventTimestamp
      )
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

function getLockKeys(record: AsyncRuleRecord): Array<string | undefined> {
  switch (record.type) {
    case 'TRANSACTION':
      return [
        record.transaction.originUserId,
        record.transaction.destinationUserId,
      ]
    case 'TRANSACTION_EVENT':
      return [record.senderUser?.userId, record.receiverUser?.userId]
    case 'TRANSACTION_BATCH':
      return [
        record.transaction.originUserId,
        record.transaction.destinationUserId,
      ]
    case 'TRANSACTION_EVENT_BATCH':
      // TODO: Improve me
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

export const asyncRuleRunnerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    clearInMemoryLocks()
    await Promise.all(
      event.Records.map(async (record) => {
        const sqsMessage = JSON.parse(record.body) as AsyncRuleRecord
        const lockKeys = compact(getLockKeys(sqsMessage))
        if (lockKeys.length === 0) {
          lockKeys.push(sqsMessage.tenantId)
        }
        const releaseLocks = await acquireInMemoryLocks(lockKeys)
        try {
          await runAsyncRules(sqsMessage)
        } finally {
          releaseLocks()
        }
      })
    )
  }
)
