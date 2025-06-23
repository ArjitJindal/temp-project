import { chunk, compact, isEmpty, memoize, uniq, uniqBy } from 'lodash'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
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
import { PaymentDetails } from '@/@types/tranasction/payment-type'

const sqs = getSQSClient()

const DEFAULT_CHUNK_SIZE = 1_000

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

type PaymentDetailsUserInfo = {
  userKeyId: string
  paymentDetails: PaymentDetails
}

type PreAggregationTask =
  | { type: 'USER_TRANSACTIONS'; ids: string[] }
  | {
      type: 'PAYMENT_DETAILS_TRANSACTIONS'
      ids: PaymentDetailsUserInfo[]
    }

@traceable
export class RulePreAggregationBatchJobRunner extends BatchJobRunner {
  private setDeduplicationIds = new Set<string>()
  private dynamoDb!: DynamoDBDocumentClient
  private mongoDb!: MongoClient
  protected async run(job: RulePreAggregationBatchJob): Promise<void> {
    this.dynamoDb = getDynamoDbClient()
    this.mongoDb = await getMongoDbClient()
    const { entity, aggregationVariables, currentTimestamp } = job.parameters
    const ruleInstanceRepository = new RuleInstanceRepository(job.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const riskRepository = new RiskRepository(job.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: await getMongoDbClient(),
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
      const { riskFactorId } = entity

      const riskFactor = await riskRepository.getRiskFactor(riskFactorId)

      if (!(riskFactor && hasFeature('RISK_SCORING'))) {
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

    for (const aggregationVariable of aggregationVariables) {
      const { ids, type } = await this.preAggregateVariable(
        job.tenantId,
        aggregationVariable,
        currentTimestamp
      )

      for (const idsChunk of chunk<PaymentDetailsUserInfo | string>(
        ids,
        DEFAULT_CHUNK_SIZE
      )) {
        let messages: FifoSqsMessage[] = []
        if (type === 'USER_TRANSACTIONS') {
          messages = (idsChunk as string[]).map((userId) =>
            getAggregationTaskMessage({
              userKeyId: userId,
              payload: {
                type: 'PRE_AGGREGATION',
                aggregationVariable,
                tenantId: job.tenantId,
                userId,
                currentTimestamp: currentTimestamp ?? Date.now(),
                jobId: this.jobId,
                entity,
              },
            })
          )
        } else if (type === 'PAYMENT_DETAILS_TRANSACTIONS') {
          messages = (idsChunk as PaymentDetailsUserInfo[]).map(
            ({ userKeyId, paymentDetails }) =>
              getAggregationTaskMessage({
                userKeyId,
                payload: {
                  type: 'PRE_AGGREGATION',
                  paymentDetails,
                  tenantId: job.tenantId,
                  currentTimestamp: currentTimestamp ?? Date.now(),
                  jobId: this.jobId,
                  entity,
                  aggregationVariable,
                },
              })
          )
        }

        await this.internalBulkSendMesasges(this.dynamoDb, messages)
      }
    }

    if (this.setDeduplicationIds.size === 0 && entity?.type === 'RULE') {
      logger.info(
        `No tasks to pre-aggregate. Switching rule instance ${entity.ruleInstanceId} to ACTIVE.`
      )
      await ruleInstanceRepository.updateRuleInstanceStatus(
        entity.ruleInstanceId,
        'ACTIVE'
      )
    }
    if (this.setDeduplicationIds.size === 0 && entity?.type === 'RISK_FACTOR') {
      logger.info(
        `No tasks to pre-aggregate. Switching rule instance ${entity.riskFactorId} to ACTIVE.`
      )
      await riskRepository.updateRiskFactorStatus(entity.riskFactorId, 'ACTIVE')
    }
  }

  private uniqueUserIds = memoize(
    async (
      tenantId: string,
      direction: 'ORIGIN' | 'DESTINATION',
      timeRange: {
        afterTimestamp: number
        beforeTimestamp: number
      }
    ) => {
      const transactionsRepo = new MongoDbTransactionRepository(
        tenantId,
        await getMongoDbClient(),
        this.dynamoDb
      )
      return await transactionsRepo.getUniqueUserIds(direction, timeRange)
    },
    (tenantId, direction, timeRange) =>
      `${tenantId}-${direction}-${timeRange.afterTimestamp}-${timeRange.beforeTimestamp}`
  )

  private uniquePaymentDetails = memoize(
    async (
      tenantId: string,
      direction: 'ORIGIN' | 'DESTINATION',
      timeRange: { afterTimestamp: number; beforeTimestamp: number }
    ) => {
      const transactionsRepo = new MongoDbTransactionRepository(
        tenantId,
        await getMongoDbClient(),
        this.dynamoDb
      )

      return await transactionsRepo.getUniquePaymentDetails(
        direction,
        timeRange
      )
    },
    (tenantId, direction, timeRange) =>
      `${tenantId}-${direction}-${timeRange.afterTimestamp}-${timeRange.beforeTimestamp}`
  )

  private async internalBulkSendMesasges(
    dynamoDb: DynamoDBDocumentClient,
    messages: FifoSqsMessage[]
  ) {
    const messagesToSend: FifoSqsMessage[] = []

    messagesToSend.push(
      ...messages.filter(
        (m) => !this.setDeduplicationIds.has(m.MessageDeduplicationId)
      )
    )

    messages.forEach((m) =>
      this.setDeduplicationIds.add(m.MessageDeduplicationId)
    )

    const dedupMessages = uniqBy(
      messagesToSend,
      (m) => m.MessageDeduplicationId
    )

    await this.jobRepository.updateJob(this.jobId, {
      $inc: { 'metadata.tasksCount': dedupMessages.length },
    })

    if (envIs('local')) {
      for (const message of dedupMessages) {
        await handleV8PreAggregationTask(
          JSON.parse(message.MessageBody),
          this.dynamoDb,
          this.mongoDb
        )
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
  }

  private async preAggregateVariable(
    tenantId: string,
    aggregationVariable: LogicAggregationVariable,
    currentTimestamp: number = Date.now()
  ): Promise<PreAggregationTask> {
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
          : await this.uniqueUserIds(tenantId, 'ORIGIN', timeRange)
      const destinationUserIds =
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : await this.uniqueUserIds(tenantId, 'DESTINATION', timeRange)
      const allUserIds = uniq(originUserIds.concat(destinationUserIds))

      return {
        ids: allUserIds,
        type: 'USER_TRANSACTIONS',
      }
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_TRANSACTIONS') {
      const originPaymentDetails =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? []
          : await this.uniquePaymentDetails(tenantId, 'ORIGIN', timeRange)
      const destinationPaymentDetails =
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : await this.uniquePaymentDetails(tenantId, 'DESTINATION', timeRange)
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

      return {
        ids: userInfos,
        type: 'PAYMENT_DETAILS_TRANSACTIONS',
      }
    }

    throw new Error(
      `Unsupported aggregation variable type: ${aggregationVariable.type}`
    )
  }
}
