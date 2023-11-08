import { SQSEvent } from 'aws-lambda'
import { cloneDeep } from 'lodash'
import { BadRequest } from 'http-errors'
import { backOff } from 'exponential-backoff'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TransactionAggregationTask } from '@/services/rules-engine'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import {
  TRANSACTION_RULES,
  TransactionRuleBase,
} from '@/services/rules-engine/transaction-rules'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { DEFAULT_RISK_LEVEL } from '@/services/risk-scoring/utils'
import {
  getContext,
  hasFeature,
  initializeTenantContext,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { TransactionAggregationRule } from '@/services/rules-engine/transaction-rules/aggregation-rule'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { logger } from '@/core/logger'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'

export async function handleTransactionAggregationTask(
  task: TransactionAggregationTask
) {
  const dynamoDb = getDynamoDbClient()
  const ruleInstanceRepository = new RuleInstanceRepository(task.tenantId, {
    dynamoDb,
  })
  const userRepository = new UserRepository(task.tenantId, {
    dynamoDb,
  })
  const riskRepository = new RiskRepository(task.tenantId, {
    dynamoDb,
  })
  const transactionRepository = new DynamoDbTransactionRepository(
    task.tenantId,
    dynamoDb
  )
  const ruleRepository = new RuleRepository(task.tenantId, {
    dynamoDb,
  })

  const [ruleInstance, transaction] = await Promise.all([
    ruleInstanceRepository.getRuleInstanceById(task.ruleInstanceId),
    backOff(
      async () => {
        const transactionId = task.transactionId
        const transaction = await transactionRepository.getTransactionById(
          transactionId
        )
        if (!transaction) {
          throw new BadRequest(`Transaction ${transactionId} not found`)
        }
        return transaction
      },
      {
        jitter: 'full',
        numOfAttempts: 3,
        startingDelay: 1000,
        maxDelay: 5000,
        retry: (e, attempt) => {
          if (attempt === 3) {
            logger.error(
              `Failed to get transaction ${task.transactionId}: ${e.message}`
            )

            return false
          }
          logger.warn(
            `Failed to get transaction ${task.transactionId}: ${e.message}`
          )
          return true
        },
      }
    ),
  ])

  updateLogMetadata(task)
  if (!ruleInstance) {
    logger.error(`Rule instance ${task.ruleInstanceId} not found`)
    return
  }

  const [originUser, destinationUser, rule, senderUserRisk] = await Promise.all(
    [
      transaction.originUserId
        ? userRepository.getUser<User | Business>(transaction.originUserId)
        : undefined,
      transaction.destinationUserId
        ? userRepository.getUser<User | Business>(transaction.destinationUserId)
        : undefined,
      ruleRepository.getRuleById(ruleInstance.ruleId),
      transaction.originUserId
        ? riskRepository.getDRSRiskItem(transaction.originUserId)
        : undefined,
    ]
  )

  if (!rule) {
    logger.error(
      `Rule ${ruleInstance.ruleId} not found for rule instance ${ruleInstance.id}`
    )
    return
  }

  const ruleImplementationName = rule.ruleImplementationName
  const senderUserRiskLevel =
    senderUserRisk?.manualRiskLevel ??
    senderUserRisk?.derivedRiskLevel ??
    DEFAULT_RISK_LEVEL

  const RuleClass = TRANSACTION_RULES[ruleImplementationName]

  const mode = 'DYNAMODB'

  const parameters =
    hasFeature('RISK_LEVELS') && ruleInstance.riskLevelParameters
      ? ruleInstance.riskLevelParameters[senderUserRiskLevel]
      : ruleInstance.parameters

  const ruleClassInstance = new (RuleClass as typeof TransactionRuleBase)(
    task.tenantId,
    {
      transaction,
      receiverUser: destinationUser,
      senderUser: originUser,
    },
    { parameters, filters: ruleInstance.filters },
    { ruleInstance, rule },
    mode,
    dynamoDb,
    undefined
  )
  if (!(ruleClassInstance instanceof TransactionAggregationRule)) {
    return
  }

  const shouldUpdateAggregation = ruleClassInstance.shouldUpdateUserAggregation(
    task.direction,
    task.isTransactionHistoricalFiltered
  )
  if (!shouldUpdateAggregation) {
    return
  }

  const isRebuilt = await ruleClassInstance.isRebuilt(task.direction)
  if (!isRebuilt) {
    logger.info('Rebuilding aggregation...')
    await ruleClassInstance.rebuildUserAggregation(
      task.direction,
      task.isTransactionHistoricalFiltered
    )
    logger.info('Rebuilt aggregation')

    logger.info('Updating aggregation...')
    await ruleClassInstance.updateAggregation(
      task.direction,
      task.isTransactionHistoricalFiltered
    )
    logger.info('Updated aggregation')
  } else {
    logger.info('Updating aggregation...')
    await ruleClassInstance.updateAggregation(
      task.direction,
      task.isTransactionHistoricalFiltered
    )
    logger.info('Updated aggregation')
  }
}

export const transactionAggregationHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await Promise.all(
      event.Records.map(async (record) => {
        const task = JSON.parse(record.body) as TransactionAggregationTask
        const context = cloneDeep(getContext() || {})
        context.tenantId = task.tenantId
        context.metricDimensions = {
          ...context.metricDimensions,
          ruleInstanceId: task.ruleInstanceId,
        }
        await withContext(async () => {
          await initializeTenantContext(task.tenantId)
          await handleTransactionAggregationTask(task)
        }, context)
      })
    )
  }
)
