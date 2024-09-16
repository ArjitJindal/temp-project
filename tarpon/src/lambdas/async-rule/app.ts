import { SQSEvent } from 'aws-lambda'
import { TransactionRiskScoringResult } from '@/@types/openapi-internal/TransactionRiskScoringResult'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-public/Business'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { initializeTenantContext, withContext } from '@/core/utils/context'
import { RulesEngineService } from '@/services/rules-engine'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserManagementService } from '@/services/rules-engine/user-rules-engine-service'
import { UserType } from '@/@types/user/user-type'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'

type AsyncRuleRecordTransaction = {
  type: 'TRANSACTION'
  transaction: Transaction
  senderUser: User | Business | null
  receiverUser: User | Business | null
  riskDetails?: TransactionRiskScoringResult
}

type AsyncRuleRecordTransactionEvent = {
  type: 'TRANSACTION_EVENT'
  updatedTransaction: Transaction
  senderUser: User | Business | null
  receiverUser: User | Business | null
  transactionEventId: string
}

type AsyncRuleRecordUser = {
  type: 'USER'
  userType: UserType
  user: User | Business
}

type AsyncRuleRecordUserEvent = {
  type: 'USER_EVENT'
  updatedUser: User | Business
  userEventTimestamp: number
  userType: UserType
}

export type AsyncRuleRecord = (
  | AsyncRuleRecordTransaction
  | AsyncRuleRecordTransactionEvent
  | AsyncRuleRecordUser
  | AsyncRuleRecordUserEvent
) & {
  tenantId: string
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

      await rulesEngineService.verifyAsyncRulesTransactionEvent(
        updatedTransaction,
        transactionEventId,
        senderUser,
        receiverUser
      )
    } else if (type === 'USER') {
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
    }
  })
}

export const asyncRuleRunnerHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const { Records } = event

    for await (const record of Records) {
      const snsMessage = JSON.parse(record.body) as AsyncRuleRecord
      await runAsyncRules(snsMessage)
    }
  }
)
