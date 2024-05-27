import { uniq, uniqBy } from 'lodash'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { isV8RuleInstance } from '../rules-engine/utils'
import { getTimeRangeByTimeWindows } from '../rules-engine/utils/time-utils'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { sendAggregationTask } from '../rules-engine/v8-engine'
import { getPaymentDetailsIdentifiersKey } from '../rules-engine/v8-variables/payment-details'
import { BatchJobRunner } from './batch-job-runner-base'
import { traceable } from '@/core/xray'
import {
  RulePreAggregationBatchJob,
  RulePreAggregationMetadata,
} from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { logger } from '@/core/logger'
import { tenantHasFeature } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { generateChecksum } from '@/utils/object'

@traceable
export class RulePreAggregationBatchJobRunner extends BatchJobRunner {
  protected async run(job: RulePreAggregationBatchJob): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const { ruleInstanceId, aggregationVariables } = job.parameters
    const ruleInstanceRepository = new RuleInstanceRepository(job.tenantId, {
      dynamoDb,
    })
    const ruleInstance = await ruleInstanceRepository.getRuleInstanceById(
      ruleInstanceId
    )
    if (!ruleInstance) {
      logger.warn(`Rule instance ${ruleInstanceId} not found. Skipping job.`)
      return
    }
    const isV8Rule =
      (await tenantHasFeature(job.tenantId, 'RULES_ENGINE_V8')) &&
      isV8RuleInstance(ruleInstance)
    if (!isV8Rule) {
      logger.warn(
        `Pre-aggregation only supports V8 rules for now. Skipping job.`
      )
      return
    }
    const metadata: RulePreAggregationMetadata = {
      tasksCount: 0,
      completeTasksCount: 0,
    }
    await this.jobRepository.updateJob(this.jobId, {
      $set: { metadata },
    })

    for (const aggregationVariable of aggregationVariables) {
      await this.preAggregateVariable(
        job.tenantId,
        ruleInstanceId,
        aggregationVariable
      )
    }
  }

  private async preAggregateVariable(
    tenantId: string,
    ruleInstanceId: string,
    aggregationVariable: RuleAggregationVariable
  ) {
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
    let tasksCount = 0
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
      for (const userId of allUserIds) {
        await sendAggregationTask({
          userKeyId: userId,
          payload: {
            type: 'PRE_AGGREGATION',
            aggregationVariable,
            tenantId,
            userId,
            currentTimestamp: Date.now(),
            jobId: this.jobId,
            ruleInstanceId,
          },
        })
        tasksCount += 1
      }
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
      const allPaymentDetails = uniqBy(
        originPaymentDetails.concat(destinationPaymentDetails),
        generateChecksum
      )
      for (const paymentDetails of allPaymentDetails) {
        const userKeyId = getPaymentDetailsIdentifiersKey(paymentDetails)
        if (userKeyId) {
          await sendAggregationTask({
            userKeyId,
            payload: {
              type: 'PRE_AGGREGATION',
              aggregationVariable,
              tenantId,
              paymentDetails,
              currentTimestamp: Date.now(),
              jobId: this.jobId,
              ruleInstanceId,
            },
          })
          tasksCount += 1
        }
      }
    } else {
      throw new Error(
        `Unsupported aggregation variable type: ${aggregationVariable.type}`
      )
    }
    await this.jobRepository.updateJob(this.jobId, {
      $inc: { 'metadata.tasksCount': tasksCount },
    })
  }
}
