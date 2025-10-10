import { SQSEvent } from 'aws-lambda'
import { InternalServerError } from 'http-errors'
import uniqBy from 'lodash/uniqBy'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
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
  hasFeature,
  initializeTenantContext,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { TransactionAggregationRule } from '@/services/rules-engine/transaction-rules/aggregation-rule'
import { User } from '@/@types/openapi-internal/User'
import { Business } from '@/@types/openapi-internal/Business'
import { logger } from '@/core/logger'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { SanctionsService } from '@/services/sanctions'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { GeoIPService } from '@/services/geo-ip'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { getAggVarHash } from '@/services/logic-evaluator/engine/aggregation-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import {
  V8TransactionAggregationTask,
  V8LogicAggregationRebuildTask,
  TransactionAggregationTask,
} from '@/@types/tranasction/aggregation'

export async function handleV8TransactionAggregationTask(
  task: V8TransactionAggregationTask,
  dynamoDb: DynamoDBDocumentClient
) {
  updateLogMetadata({
    tenantId: task.tenantId,
    direction: task.direction,
    transactionId: task.transaction.transactionId,
    type: task.type,
  })
  const ruleEvaluator = new LogicEvaluator(task.tenantId, dynamoDb)
  if (task.aggregationVariable) {
    if (!task.direction) {
      throw new Error('Direction is required')
    }
    // Update for a single aggregation variable
    updateLogMetadata({
      aggregationVariableKey: task.aggregationVariable.key,
    })
    await ruleEvaluator.rebuildOrUpdateAggregationVariable(
      task.aggregationVariable,
      {
        transaction: task.transaction,
        transactionEvents: [],
        type: 'TRANSACTION',
      },
      task.direction
    )
  } else {
    // Update all aggregation variables by applying the new transaction
    const ruleInstanceRepo = new RuleInstanceRepository(task.tenantId, {
      dynamoDb,
    })
    const ruleInstances = [
      ...(await ruleInstanceRepo.getActiveRuleInstances()),
      ...(await ruleInstanceRepo.getDeployingRuleInstances()),
    ]
    const logicAggregationVariables = uniqBy(
      ruleInstances.flatMap((r) => r.logicAggregationVariables ?? []),
      getAggVarHash
    )

    const transactionEventRepository = new TransactionEventRepository(
      task.tenantId,
      { dynamoDb }
    )
    const transactionEvents =
      await transactionEventRepository.getTransactionEvents(
        task.transaction.transactionId
      )
    await Promise.all(
      logicAggregationVariables.map(async (v) => {
        await ruleEvaluator.updateAggregationVariable(
          v,
          {
            transaction: task.transaction,
            transactionEvents,
            type: 'TRANSACTION',
          },
          { skipIfNotReady: true }
        )
      })
    )
  }
}

export async function handleV8PreAggregationTask(
  task: V8LogicAggregationRebuildTask,
  dynamoDb: DynamoDBDocumentClient,
  mongoDb: MongoClient
) {
  updateLogMetadata({
    aggregationVariableKey: task.aggregationVariable.key,
    tenantId: task.tenantId,
    type: task.type,
    userId: task.userId,
    entity: task.entity,
    jobId: task.jobId,
  })
  const jobRepository = new BatchJobRepository(task.tenantId, mongoDb)

  const ruleInstanceRepository = new RuleInstanceRepository(task.tenantId, {
    dynamoDb,
  })

  const riskRepository = new RiskRepository(task.tenantId, {
    dynamoDb,
    mongoDb,
  })

  const ruleEvaluator = new LogicEvaluator(task.tenantId, dynamoDb)

  if (task.entity?.type === 'RULE') {
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
        task.paymentDetails,
        task.entityData,
        task.timeWindow,
        task.totalSliceCount
      )
    }

    const newJob = await jobRepository.incrementCompleteTasksCount(task.jobId)

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
  } else if (task.entity?.type === 'RISK_FACTOR') {
    const riskFactor = await riskRepository.getRiskFactor(
      task.entity.riskFactorId
    )

    const noRiskFactorAggregateConditions = !!(
      !riskFactor ||
      !(riskFactor.status === 'ACTIVE') ||
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
        task.paymentDetails,
        task.entityData,
        task.timeWindow,
        task.totalSliceCount
      )
    }

    const newJob = await jobRepository.incrementCompleteTasksCount(task.jobId)
    if (
      newJob.metadata &&
      newJob.metadata.completeTasksCount >= newJob.metadata.tasksCount &&
      riskFactor?.status === 'DEPLOYING'
    ) {
      logger.info(
        `Pre-aggregation complete (job: ${task.jobId}). Switching rule instance ${riskFactor.id} to ACTIVE.`
      )
      await riskRepository.updateRiskFactorStatus(riskFactor.id, 'ACTIVE')
    }
  } else if (!task.entity) {
    await ruleEvaluator.rebuildAggregationVariable(
      task.aggregationVariable,
      task.currentTimestamp,
      task.userId,
      task.paymentDetails,
      task.entityData,
      task.timeWindow,
      task.totalSliceCount
    )
    await jobRepository.incrementCompleteTasksCount(task.jobId)
  }
}

export async function handleTransactionAggregationTask(
  task: TransactionAggregationTask,
  dynamoDb: DynamoDBDocumentClient,
  mongoDb: MongoClient
) {
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

  const transaction = await transactionRepository.getTransactionById(
    task.transactionId
  )

  if (!transaction) {
    throw new InternalServerError(
      `Transaction ${task.transactionId} not found!`
    )
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
      stage: 'INITIAL',
    },
    { parameters, filters: ruleInstance.filters },
    { ruleInstance, rule },
    {
      sanctionsService: new SanctionsService(task.tenantId, {
        mongoDb,
        dynamoDb,
      }),
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
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
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
                | V8LogicAggregationRebuildTask
              if (v8Task.type === 'TRANSACTION_AGGREGATION') {
                await handleV8TransactionAggregationTask(v8Task, dynamoDb)
              } else if (v8Task.type === 'PRE_AGGREGATION') {
                await handleV8PreAggregationTask(v8Task, dynamoDb, mongoDb)
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
              await handleTransactionAggregationTask(
                legacyTask,
                dynamoDb,
                mongoDb
              )
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
