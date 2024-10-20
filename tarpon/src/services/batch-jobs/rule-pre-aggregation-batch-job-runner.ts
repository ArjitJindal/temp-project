import { compact, isEmpty, uniq, uniqBy } from 'lodash'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { getTimeRangeByTimeWindows } from '../rules-engine/utils/time-utils'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { getPaymentDetailsIdentifiersKey } from '../logic-evaluator/variables/payment-details'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import {
  TransactionAggregationTaskEntry,
  V8LogicAggregationRebuildTask,
} from '../rules-engine'
import { getAggVarHash } from '../logic-evaluator/engine/aggregation-repository'
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
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import {
  bulkSendMessages,
  FifoSqsMessage,
  getSQSClient,
  sanitizeDeduplicationId,
} from '@/utils/sns-sqs-client'
import { envIs } from '@/utils/env'
import { handleV8PreAggregationTask } from '@/lambdas/transaction-aggregation/app'
import { TransientRepository } from '@/core/repositories/transient-repository'
import { duration } from '@/utils/dayjs'
import { generateChecksum } from '@/utils/object'

const sqs = getSQSClient()

function getAggregationTaskMessage(
  task: TransactionAggregationTaskEntry
): FifoSqsMessage {
  const payload = task.payload as V8LogicAggregationRebuildTask
  const deduplicationId = generateChecksum(
    `${task.userKeyId}:${getAggVarHash(payload.aggregationVariable)}`
  )
  return {
    MessageBody: JSON.stringify(payload),
    MessageGroupId: generateChecksum(task.userKeyId),
    MessageDeduplicationId: deduplicationId,
  }
}

@traceable
export class RulePreAggregationBatchJobRunner extends BatchJobRunner {
  protected async run(job: RulePreAggregationBatchJob): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const { entity, aggregationVariables, currentTimestamp } = job.parameters
    const ruleInstanceRepository = new RuleInstanceRepository(job.tenantId, {
      dynamoDb,
    })

    if (entity?.type === 'RULE') {
      const { ruleInstanceId } = entity
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
    } else if (entity?.type === 'RISK_FACTOR') {
      const riskRepository = new RiskRepository(job.tenantId, {
        dynamoDb,
        mongoDb: await getMongoDbClient(),
      })

      const { riskFactorId } = entity

      const riskFactor = await riskRepository.getRiskFactor(riskFactorId)

      if (!(riskFactor && hasFeature('RISK_SCORING_V8'))) {
        logger.warn(`Risk factor ${riskFactorId} not found. Skipping job.`)
        return
      }
    }

    const existingJob = (await this.jobRepository.getJobById(
      this.jobId
    )) as RulePreAggregationBatchJob | null
    if (!existingJob?.metadata) {
      // First run
      const metadata: RulePreAggregationMetadata = {
        tasksCount: 0,
        completeTasksCount: 0,
      }
      await this.jobRepository.updateJob(this.jobId, {
        $set: { metadata },
      })
    }

    const messages: FifoSqsMessage[] = []
    for (const aggregationVariable of aggregationVariables) {
      const varMessages = await this.preAggregateVariable(
        job.tenantId,
        entity,
        aggregationVariable,
        currentTimestamp
      )
      messages.push(...varMessages)
    }
    const dedupMessages = uniqBy(messages, (m) => m.MessageDeduplicationId)

    await this.jobRepository.updateJob(this.jobId, {
      $set: { 'metadata.tasksCount': dedupMessages.length },
    })

    if (envIs('local')) {
      for (const message of dedupMessages) {
        await handleV8PreAggregationTask(JSON.parse(message.MessageBody))
      }
    } else {
      const transientRepository = new TransientRepository(
        dynamoDb,
        duration(7, 'day').asSeconds()
      )
      // Filter the messages that have not been sent yet
      const messagesNotSentYet: FifoSqsMessage[] = []
      for (const message of dedupMessages) {
        if (
          !(await transientRepository.hasKey(
            this.jobId,
            sanitizeDeduplicationId(message.MessageDeduplicationId)
          ))
        ) {
          messagesNotSentYet.push(message)
        }
      }
      await bulkSendMessages(
        sqs,
        process.env.TRANSACTION_AGGREGATION_QUEUE_URL as string,
        messagesNotSentYet,
        async (batch) => {
          // Mark the messages as sent to avoid being sent again on retries
          for (const message of batch) {
            await transientRepository.addKey(
              this.jobId,
              message.MessageDeduplicationId as string
            )
          }
        }
      )
    }

    logger.info(`Total tasks: ${dedupMessages.length}`)

    if (dedupMessages.length === 0 && entity?.type === 'RULE') {
      logger.info(
        `No tasks to pre-aggregate. Switching rule instance ${entity.ruleInstanceId} to ACTIVE.`
      )
      await ruleInstanceRepository.updateRuleInstanceStatus(
        entity.ruleInstanceId,
        'ACTIVE'
      )
    }
  }

  private async preAggregateVariable(
    tenantId: string,
    entity: RulePreAggregationBatchJob['parameters']['entity'],
    aggregationVariable: LogicAggregationVariable,
    currentTimestamp: number = Date.now()
  ): Promise<Array<FifoSqsMessage>> {
    const transactionsRepo = new MongoDbTransactionRepository(
      tenantId,
      await getMongoDbClient()
    )
    const { timeWindow } = aggregationVariable
    const timeRange = getTimeRangeByTimeWindows(
      currentTimestamp,
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

      return allUserIds.map((userId) =>
        getAggregationTaskMessage({
          userKeyId: userId,
          payload: {
            type: 'PRE_AGGREGATION',
            aggregationVariable,
            tenantId,
            userId,
            currentTimestamp,
            jobId: this.jobId,
            entity,
          },
        })
      )
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
      return userInfos.map((userInfo) =>
        getAggregationTaskMessage({
          userKeyId: userInfo.userKeyId,
          payload: {
            type: 'PRE_AGGREGATION',
            aggregationVariable,
            tenantId,
            paymentDetails: userInfo.paymentDetails,
            currentTimestamp,
            jobId: this.jobId,
            entity,
          },
        })
      )
    }

    throw new Error(
      `Unsupported aggregation variable type: ${aggregationVariable.type}`
    )
  }
}
