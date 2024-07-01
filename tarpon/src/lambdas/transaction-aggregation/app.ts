import { SQSEvent } from 'aws-lambda'
import { NotFound } from 'http-errors'
import { backOff } from 'exponential-backoff'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  TransactionAggregationTask,
  V8RuleAggregationRebuildTask,
  V8TransactionAggregationTask,
} from '@/services/rules-engine'
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
import { Transaction } from '@/@types/openapi-public/Transaction'
import { RuleJsonLogicEvaluator } from '@/services/rules-engine/v8-engine'
import { SanctionsService } from '@/services/sanctions'
import { IBANService } from '@/services/iban'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RulePreAggregationBatchJob } from '@/@types/batch-job'

export async function handleV8TransactionAggregationTask(
  task: V8TransactionAggregationTask
) {
  updateLogMetadata({
    aggregationVariableKey: task.aggregationVariable.key,
    tenantId: task.tenantId,
    direction: task.direction,
    transactionId: task.transaction.transactionId,
  })
  const dynamoDb = getDynamoDbClient()
  const ruleEvaluator = new RuleJsonLogicEvaluator(task.tenantId, dynamoDb)
  await ruleEvaluator.rebuildOrUpdateAggregationVariable(
    task.aggregationVariable,
    { transaction: task.transaction, type: 'TRANSACTION' },
    task.direction
  )
}

export async function handleV8PreAggregationTask(
  task: V8RuleAggregationRebuildTask
) {
  updateLogMetadata({
    aggregationVariableKey: task.aggregationVariable.key,
    tenantId: task.tenantId,
  })
  const dynamoDb = getDynamoDbClient()
  const jobRepository = new BatchJobRepository(
    task.tenantId,
    await getMongoDbClient()
  )
  const ruleInstanceRepository = new RuleInstanceRepository(task.tenantId, {
    dynamoDb,
  })
  const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
    task.ruleInstanceId
  )
  if (
    !ruleInstance ||
    ruleInstance.status === 'INACTIVE' ||
    ruleInstance.logicAggregationVariables?.find(
      (v) => v.version !== task.aggregationVariable.version
    )
  ) {
    logger.warn(
      `Rule instance ${task.ruleInstanceId} is changed/deleted. Skipping pre-aggregation.`
    )
  } else {
    const ruleEvaluator = new RuleJsonLogicEvaluator(task.tenantId, dynamoDb)
    await ruleEvaluator.rebuildAggregationVariable(
      task.aggregationVariable,
      task.currentTimestamp,
      task.userId,
      task.paymentDetails
    )
  }
  const newJob = (await jobRepository.updateJob(task.jobId, {
    $inc: { 'metadata.completeTasksCount': 1 },
  })) as RulePreAggregationBatchJob

  if (
    newJob.metadata &&
    newJob.metadata.completeTasksCount >= newJob.metadata.tasksCount &&
    ruleInstance?.status === 'DEPLOYING'
  ) {
    logger.info(
      `Pr-aggregation complete (job: ${task.jobId}). Switching rule instance ${task.ruleInstanceId} to ACTIVE`
    )
    await ruleInstanceRepository.updateRuleInstanceStatus(
      ruleInstance.id as string,
      'ACTIVE'
    )
  }
}

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

  let transaction: Transaction | undefined
  try {
    transaction = await backOff(
      async () => {
        const transactionId = task.transactionId
        const transaction = await transactionRepository.getTransactionById(
          transactionId
        )
        if (!transaction) {
          throw new NotFound(`Transaction ${transactionId} not found`)
        }
        return transaction
      },
      {
        jitter: 'full',
        numOfAttempts: 3,
        startingDelay: 1000,
        maxDelay: 5000,
      }
    )
  } catch (e) {
    if (e instanceof NotFound) {
      logger.error(
        `Failed to get transaction ${task.transactionId}: ${e.message}`
      )
      return
    } else {
      throw e
    }
  }

  const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
    task.ruleInstanceId
  )

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
      ruleInstance.ruleId
        ? ruleRepository.getRuleById(ruleInstance.ruleId)
        : undefined,
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

  const ruleImplementationName = rule.ruleImplementationName ?? ''
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
    {
      sanctionsService: new SanctionsService(task.tenantId),
      ibanService: new IBANService(task.tenantId),
    },
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
        const task = JSON.parse(record.body) as
          | TransactionAggregationTask
          | V8TransactionAggregationTask
        await withContext(
          async () => {
            await initializeTenantContext(task.tenantId)

            if ((task as V8TransactionAggregationTask).type) {
              const v8Task = task as
                | V8TransactionAggregationTask
                | V8RuleAggregationRebuildTask
              if (v8Task.type === 'TRANSACTION_AGGREGATION') {
                await handleV8TransactionAggregationTask(v8Task)
              } else if (v8Task.type === 'PRE_AGGREGATION') {
                await handleV8PreAggregationTask(v8Task)
              }
            } else {
              updateLogMetadata(task)
              const legacyTask = task as TransactionAggregationTask
              const context = getContext()
              if (context) {
                context.metricDimensions = {
                  ...context.metricDimensions,
                  ruleInstanceId: legacyTask.ruleInstanceId,
                }
              }
              await handleTransactionAggregationTask(legacyTask)
            }
          },
          {
            ...(getContext() ?? {}),
            tenantId: task.tenantId,
          }
        )
      })
    )
  }
)
