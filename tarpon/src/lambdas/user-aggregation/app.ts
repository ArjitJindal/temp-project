import { SQSEvent } from 'aws-lambda'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import {
  initializeTenantContext,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { getAggVarHash } from '@/services/logic-evaluator/engine/aggregation-repository'
import { BatchJobRepository } from '@/services/batch-jobs/repositories/batch-job-repository'
import { V8LogicAggregationRebuildTask } from '@/@types/tranasction/aggregation'

export async function handleV8PreAggregationTask(
  task: V8LogicAggregationRebuildTask
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

  const ruleEvaluator = new LogicEvaluator(task.tenantId, dynamoDb)
  if (task.userId === undefined) {
    logger.warn(`No userId. Skipping pre-aggregation`)
    return
  }
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
      await ruleEvaluator.rebuildUserAggregationVariable(
        task.aggregationVariable,
        task.currentTimestamp,
        task.userId
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
      await ruleEvaluator.rebuildUserAggregationVariable(
        task.aggregationVariable,
        task.currentTimestamp,
        task.userId
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
    await ruleEvaluator.rebuildUserAggregationVariable(
      task.aggregationVariable,
      task.currentTimestamp,
      task.userId
    )
    await jobRepository.incrementCompleteTasksCount(task.jobId)
  }
}

export const userAggregationHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await Promise.all(
      event.Records.map(async (record) => {
        const task = JSON.parse(record.body) as V8LogicAggregationRebuildTask
        await withContext(
          async () => {
            await initializeTenantContext(task.tenantId)

            if (task.type) {
              const v8Task = task as V8LogicAggregationRebuildTask
              if (v8Task.type === 'PRE_AGGREGATION') {
                await handleV8PreAggregationTask(v8Task)
              }
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
