import { compact, isEmpty, uniq, uniqBy } from 'lodash'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { getTimeRangeByTimeWindows } from '../rules-engine/utils/time-utils'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { sendAggregationTask } from '../rules-engine/v8-engine'
import { getPaymentDetailsIdentifiersKey } from '../rules-engine/v8-variables/payment-details'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { traceable } from '@/core/xray'
import {
  RulePreAggregationBatchJob,
  RulePreAggregationMetadata,
} from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import { hasFeature, tenantHasFeature } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'

@traceable
export class RulePreAggregationBatchJobRunner extends BatchJobRunner {
  private sentTaskDedupIds = new Set<string>()

  protected async run(job: RulePreAggregationBatchJob): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const { entity, aggregationVariables } = job.parameters
    const ruleInstanceRepository = new RuleInstanceRepository(job.tenantId, {
      dynamoDb,
    })

    const ruleInstanceId =
      entity.type === 'RULE'
        ? entity.ruleInstanceId
        : job.parameters.ruleInstanceId

    if (ruleInstanceId) {
      const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
        ruleInstanceId
      )
      if (!ruleInstance) {
        logger.warn(`Rule instance ${ruleInstanceId} not found. Skipping job.`)
        return
      }

      const isV8Rule =
        (await tenantHasFeature(job.tenantId, 'RULES_ENGINE_V8')) &&
        !isEmpty(ruleInstance.logicAggregationVariables)

      if (!isV8Rule) {
        logger.warn(
          `Pre-aggregation only supports V8 rules for now. Skipping job.`
        )
        return
      }
    } else if (entity.type === 'RISK_FACTOR') {
      const riskRepository = new RiskRepository(job.tenantId, {
        dynamoDb,
        mongoDb: await getMongoDbClient(),
      })

      const { riskFactorId } = entity

      const riskFactor = await riskRepository.getParameterRiskItemV8(
        riskFactorId
      )

      if (!(riskFactor && hasFeature('RISK_FACTORS_V8'))) {
        logger.warn(`Risk factor ${riskFactorId} not found. Skipping job.`)
        return
      }
    }

    const metadata: RulePreAggregationMetadata = {
      tasksCount: 0,
      completeTasksCount: 0,
    }
    await this.jobRepository.updateJob(this.jobId, {
      $set: { metadata },
    })

    let tasks = 0
    for (const aggregationVariable of aggregationVariables) {
      const aggVarTasks = await this.preAggregateVariable(
        job.tenantId,
        entity,
        aggregationVariable,
        ruleInstanceId
      )
      logger.info(`Tasks (${aggregationVariable.key}): ${aggVarTasks}`)
      tasks += aggVarTasks
    }
    logger.info(`Total tasks: ${tasks}`)

    if (tasks === 0 && ruleInstanceId) {
      logger.info(
        `No tasks to pre-aggregate. Switching rule instance ${ruleInstanceId} to ACTIVE.`
      )
      await ruleInstanceRepository.updateRuleInstanceStatus(
        ruleInstanceId,
        'ACTIVE'
      )
    }
  }

  private async preAggregateVariable(
    tenantId: string,
    entity: RulePreAggregationBatchJob['parameters']['entity'],
    aggregationVariable: RuleAggregationVariable,
    ruleInstanceId?: string
  ): Promise<number> {
    const transactionsRepo = new MongoDbTransactionRepository(
      tenantId,
      await getMongoDbClient()
    )
    const { timeWindow } = aggregationVariable
    const timeRange = getTimeRangeByTimeWindows(
      Date.now(),
      timeWindow.start,
      timeWindow.end
    )
    if (aggregationVariable.type === 'USER_TRANSACTIONS') {
      const originUserIds =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? []
          : await transactionsRepo.getUniqueUserIds('ORIGIN', timeRange)
      const destinationUserIds =
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : await transactionsRepo.getUniqueUserIds('DESTINATION', timeRange)
      const allUserIds = uniq(originUserIds.concat(destinationUserIds))

      let sentTasksCount = 0
      for (const userId of allUserIds) {
        const dedupId = await sendAggregationTask({
          userKeyId: userId,
          payload: {
            type: 'PRE_AGGREGATION',
            aggregationVariable,
            tenantId,
            userId,
            currentTimestamp: Date.now(),
            jobId: this.jobId,
            entity,
            ruleInstanceId,
          },
        })
        if (!this.sentTaskDedupIds.has(dedupId)) {
          sentTasksCount += 1
          this.sentTaskDedupIds.add(dedupId)
        }
      }
      await this.incrementTasksCount(sentTasksCount)
      return sentTasksCount
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_TRANSACTIONS') {
      const originPaymentDetails =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? []
          : await transactionsRepo.getUniquePaymentDetails('ORIGIN', timeRange)
      const destinationPaymentDetails =
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : await transactionsRepo.getUniquePaymentDetails(
              'DESTINATION',
              timeRange
            )
      const userInfos = compact(
        uniqBy(
          originPaymentDetails.concat(destinationPaymentDetails),
          getPaymentDetailsIdentifiersKey
        ).map((v) => {
          const userKeyId = getPaymentDetailsIdentifiersKey(v)
          if (userKeyId) {
            return { userKeyId, paymentDetails: v }
          }
        })
      )
      let sentTasksCount = 0
      for (const userInfo of userInfos) {
        const dedupId = await sendAggregationTask({
          userKeyId: userInfo.userKeyId,
          payload: {
            type: 'PRE_AGGREGATION',
            aggregationVariable,
            tenantId,
            paymentDetails: userInfo.paymentDetails,
            currentTimestamp: Date.now(),
            jobId: this.jobId,
            entity,
            ruleInstanceId,
          },
        })
        if (!this.sentTaskDedupIds.has(dedupId)) {
          sentTasksCount += 1
          this.sentTaskDedupIds.add(dedupId)
        }
      }
      await this.incrementTasksCount(sentTasksCount)
      return sentTasksCount
    }

    throw new Error(
      `Unsupported aggregation variable type: ${aggregationVariable.type}`
    )
  }

  private async incrementTasksCount(tasksCount: number) {
    await this.jobRepository.updateJob(this.jobId, {
      $inc: { 'metadata.tasksCount': tasksCount },
    })
  }
}
