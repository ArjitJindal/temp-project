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
import { getAggVarHash } from '@/services/rules-engine/v8-engine/aggregation-repository'
import { GeoIPService } from '@/services/geo-ip'

export async function handleV8TransactionAggregationTask(
  task: V8TransactionAggregationTask
) {
  updateLogMetadata({
    aggregationVariableKey: task.aggregationVariable.key,
    tenantId: task.tenantId,
    direction: task.direction,
    transactionId: task.transaction.transactionId,
    type: task.type,
  })
  const dynamoDb = getDynamoDbClient()
  const ruleEvaluator = new RuleJsonLogicEvaluator(task.tenantId, dynamoDb)
  await ruleEvaluator.rebuildOrUpdateAggregationVariable(
    task.aggregationVariable,
    {
      transaction: task.transaction,
      transactionEvents: [],
      type: 'TRANSACTION',
    },
    task.direction
  )
}

export async function handleV8PreAggregationTask(
  task: V8RuleAggregationRebuildTask
) {
  updateLogMetadata({
    aggregationVariableKey: task.aggregationVariable.key,
    tenantId: task.tenantId,
    type: task.type,
    userId: task.userId,
    entity: task.entity,
    jobId: task.jobId,
  })
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const jobRepository = new BatchJobRepository(task.tenantId, mongoDb)

  const ruleInstanceRepository = new RuleInstanceRepository(task.tenantId, {
    dynamoDb,
  })

  const riskRepository = new RiskRepository(task.tenantId, {
    dynamoDb,
    mongoDb,
  })

  const ruleEvaluator = new RuleJsonLogicEvaluator(task.tenantId, dynamoDb)

  if (task.entity.type === 'RULE') {
    const ruleInstanceId = task.entity.ruleInstanceId
    if (!ruleInstanceId) {
      logger.error(`Rule instance ID is required for pre-aggregation task`)
      return
    }

    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      ruleInstanceId
    )

    let shouldSkipPreAggregation = false
    if (!ruleInstance) {
      logger.warn(
        `Rule instance ${ruleInstanceId} is deleted. Skipping pre-aggregation.`
      )
      shouldSkipPreAggregation = true
    } else if (ruleInstance.status === 'INACTIVE') {
      logger.warn(
        `Rule instance ${ruleInstanceId} is inactive. Skipping pre-aggregation.`
      )
      shouldSkipPreAggregation = true
    } else if (
      !ruleInstance.logicAggregationVariables?.find(
        (v) => getAggVarHash(v) === getAggVarHash(task.aggregationVariable)
      )
    ) {
      logger.warn(
        `Rule instance ${ruleInstanceId} has changed. Skipping pre-aggregation.`
      )
      shouldSkipPreAggregation = true
    }

    if (!shouldSkipPreAggregation) {
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
        `Pre-aggregation complete (job: ${task.jobId}). Switching rule instance ${ruleInstanceId} to ACTIVE.`
      )
      await ruleInstanceRepository.updateRuleInstanceStatus(
        ruleInstance.id as string,
        'ACTIVE'
      )
    }
  } else if (task.entity.type === 'RISK_FACTOR') {
    const riskFactor = await riskRepository.getParameterRiskItemV8(
      task.entity.riskFactorId
    )

    const noRiskFactorAggregateConditions = !!(
      !riskFactor ||
      !riskFactor.isActive ||
      !riskFactor.logicAggregationVariables?.find(
        (v) => getAggVarHash(v) === getAggVarHash(task.aggregationVariable)
      )
    )

    if (noRiskFactorAggregateConditions) {
      logger.warn(
        `Risk factor ${task.entity.riskFactorId} is changed/deleted. Skipping pre-aggregation.`
      )
    } else {
      await ruleEvaluator.rebuildAggregationVariable(
        task.aggregationVariable,
        task.currentTimestamp,
        task.userId,
        task.paymentDetails
      )
    }

    await jobRepository.updateJob(task.jobId, {
      $inc: { 'metadata.completeTasksCount': 1 },
    })
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
          transactionId,
          { consistentRead: true }
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
      geoIpService: new GeoIPService(task.tenantId, dynamoDb),
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
