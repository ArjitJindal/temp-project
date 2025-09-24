import chunk from 'lodash/chunk'
import compact from 'lodash/compact'
import floor from 'lodash/floor'
import isEmpty from 'lodash/isEmpty'
import memoize from 'lodash/memoize'
import range from 'lodash/range'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { getTimeRangeByTimeWindows } from '../rules-engine/utils/time-utils'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { getPaymentDetailsIdentifiersKey } from '../logic-evaluator/variables/payment-details'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import {
  TimestampRange,
  TransactionAggregationTaskEntry,
  V8LogicAggregationRebuildTask,
} from '../rules-engine'
import {
  getAggVarHash,
  TIME_SLICE_COUNT,
} from '../logic-evaluator/engine/aggregation-repository'
import {
  canAggregate,
  getAggregationGranularity,
} from '../logic-evaluator/engine/utils'
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
import dayjs, { duration } from '@/utils/dayjs'
import { generateChecksum } from '@/utils/object'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

const sqs = getSQSClient()

const DEFAULT_CHUNK_SIZE = 1_000

function getAggregationTaskMessage(
  task: TransactionAggregationTaskEntry,
  sliceCount?: number
): FifoSqsMessage {
  const payload = task.payload as V8LogicAggregationRebuildTask
  const deduplicationId = generateChecksum(
    `${task.userKeyId}${sliceCount ? `-${sliceCount}` : ''}:${getAggVarHash(
      payload.aggregationVariable
    )}`
  )
  return {
    MessageBody: JSON.stringify(payload),
    MessageGroupId: generateChecksum(
      `${task.userKeyId}${sliceCount ? `-${sliceCount}` : ''}`
    ),
    MessageDeduplicationId: deduplicationId,
  }
}

type PaymentDetailsUserInfo = {
  userKeyId: string
  paymentDetails: PaymentDetails
}

export type UserInfoTypes = 'ADDRESS' | 'EMAIL' | 'NAME'

interface PaymentDetailsInfo {
  userKeyId: string
  value: string
  type: UserInfoTypes
}

interface PaymentDetailsAddressUserInfo extends PaymentDetailsInfo {
  type: 'ADDRESS'
}

interface PaymentDetailsNameUserInfo extends PaymentDetailsInfo {
  type: 'NAME'
}

interface PaymentDetailsEmailUserInfo extends PaymentDetailsInfo {
  type: 'EMAIL'
}

type PaymentDetailsAggregation =
  | PaymentDetailsAddressUserInfo
  | PaymentDetailsEmailUserInfo
  | PaymentDetailsNameUserInfo

type PreAggregationTask =
  | { type: 'USER_TRANSACTIONS'; ids: string[] }
  | { type: 'PAYMENT_DETAILS_TRANSACTIONS'; ids: PaymentDetailsUserInfo[] }
  | { type: 'PAYMENT_DETAILS_ADDRESS'; ids: PaymentDetailsAddressUserInfo[] }
  | { type: 'PAYMENT_DETAILS_EMAIL'; ids: PaymentDetailsEmailUserInfo[] }
  | { type: 'PAYMENT_DETAILS_NAME'; ids: PaymentDetailsNameUserInfo[] }

@traceable
export class RulePreAggregationBatchJobRunner extends BatchJobRunner {
  private setDeduplicationIds = new Set<string>()
  private dynamoDb!: DynamoDBDocumentClient
  private mongoDb!: MongoClient
  protected async run(job: RulePreAggregationBatchJob): Promise<void> {
    this.dynamoDb = getDynamoDbClient()
    this.mongoDb = await getMongoDbClient()
    const tenantId = job.tenantId
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
      await this.jobRepository.setMetadata(this.jobId, metadata)
    }

    for (const aggregationVariable of aggregationVariables) {
      const { ids, type } = await this.preAggregateVariable(
        job.tenantId,
        aggregationVariable,
        currentTimestamp
      )
      const timeRanges = this.splitAggregationWindow(
        aggregationVariable,
        currentTimestamp ?? Date.now(),
        tenantId
      )
      for (const idsChunk of chunk<
        PaymentDetailsUserInfo | string | PaymentDetailsAggregation
      >(ids, DEFAULT_CHUNK_SIZE)) {
        let messages: FifoSqsMessage[] = []
        if (type === 'USER_TRANSACTIONS') {
          messages = (idsChunk as string[]).flatMap((userId) => {
            if (timeRanges !== null) {
              return timeRanges.map((range, index) =>
                getAggregationTaskMessage(
                  {
                    userKeyId: userId,
                    payload: {
                      type: 'PRE_AGGREGATION',
                      userId,
                      tenantId: job.tenantId,
                      currentTimestamp: currentTimestamp ?? Date.now(),
                      timeWindow: range,
                      jobId: this.jobId,
                      entity,
                      aggregationVariable,
                      totalSliceCount: timeRanges.length,
                    },
                  },
                  index
                )
              )
            }
            return getAggregationTaskMessage({
              userKeyId: userId,
              payload: {
                type: 'PRE_AGGREGATION',
                userId,
                tenantId: job.tenantId,
                currentTimestamp: currentTimestamp ?? Date.now(),
                jobId: this.jobId,
                entity,
                aggregationVariable,
              },
            })
          })
        } else if (type === 'PAYMENT_DETAILS_TRANSACTIONS') {
          messages = (idsChunk as PaymentDetailsUserInfo[]).flatMap(
            ({ userKeyId, paymentDetails }) => {
              if (timeRanges !== null) {
                return timeRanges.map((range, index) =>
                  getAggregationTaskMessage(
                    {
                      userKeyId,
                      payload: {
                        type: 'PRE_AGGREGATION',
                        paymentDetails,
                        tenantId: job.tenantId,
                        currentTimestamp: currentTimestamp ?? Date.now(),
                        timeWindow: range,
                        jobId: this.jobId,
                        entity,
                        totalSliceCount: timeRanges.length,
                        aggregationVariable,
                      },
                    },
                    index
                  )
                )
              }
              return getAggregationTaskMessage({
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
            }
          )
        } else if (
          type === 'PAYMENT_DETAILS_ADDRESS' ||
          type === 'PAYMENT_DETAILS_EMAIL' ||
          type === 'PAYMENT_DETAILS_NAME'
        ) {
          messages = (idsChunk as PaymentDetailsAggregation[]).flatMap(
            ({ userKeyId, value, type }) => {
              return getAggregationTaskMessage({
                userKeyId,
                payload: {
                  type: 'PRE_AGGREGATION',
                  tenantId: job.tenantId,
                  currentTimestamp: currentTimestamp ?? Date.now(),
                  jobId: this.jobId,
                  entity,
                  aggregationVariable,
                  aggregationData: {
                    type: type,
                    value: value,
                  },
                },
              })
            }
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

  private uniqueEntityDetails = memoize(
    async (
      tenantId: string,
      direction: 'ORIGIN' | 'DESTINATION',
      timeRange: { afterTimestamp: number; beforeTimestamp: number },
      type: 'ADDRESS' | 'EMAIL' | 'NAME'
    ) => {
      const transactionsRepo = new MongoDbTransactionRepository(
        tenantId,
        await getMongoDbClient(),
        this.dynamoDb
      )
      return await transactionsRepo.getUniqueEntityDetails(
        direction,
        timeRange,
        type
      )
    },
    (tenantId, direction, timeRange, type) =>
      `${tenantId}-${direction}-${timeRange.afterTimestamp}-${timeRange.beforeTimestamp}-${type}`
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

    await this.jobRepository.incrementMetadataTasksCount(
      this.jobId,
      dedupMessages.length
    )

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

  private splitAggregationWindow(
    aggregationVar: LogicAggregationVariable,
    currentTimestamp: number,
    tenantId: string
  ): TimestampRange[] | null {
    const timeWindow = aggregationVar.timeWindow
    const canAggregateVar = canAggregate(timeWindow)
    const aggregationGranularity = getAggregationGranularity(
      aggregationVar.timeWindow,
      tenantId
    )
    if (!canAggregateVar || aggregationVar.lastNEntities) {
      // As we need continous transaction aggregation for lastN
      return null
    }
    const { afterTimestamp } = getTimeRangeByTimeWindows(
      currentTimestamp,
      timeWindow.start,
      timeWindow.end
    )
    const duration = dayjs(currentTimestamp).diff(
      dayjs(afterTimestamp),
      aggregationGranularity,
      false
    )
    if (duration <= 1) {
      return null
    }
    const sliceCount = Math.min(duration, TIME_SLICE_COUNT)
    const timeSlice = floor(duration / sliceCount)
    return range(sliceCount).map((index) => {
      const sliceStart = dayjs(afterTimestamp)
        .add(index * timeSlice, aggregationGranularity)
        .valueOf()
      const sliceEnd =
        index === sliceCount - 1
          ? currentTimestamp
          : dayjs(afterTimestamp)
              .add((index + 1) * timeSlice, aggregationGranularity)
              .valueOf()

      return {
        startTimestamp: sliceStart,
        endTimestamp: sliceEnd,
      }
    })
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
    } else if (this.isPaymentDetailsEntityType(aggregationVariable.type)) {
      const entityType = this.getEntityTypeFromAggregationType(
        aggregationVariable.type
      )

      const [originEntities, destinationEntities] = await Promise.all([
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? []
          : this.uniqueEntityDetails(tenantId, 'ORIGIN', timeRange, entityType),
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : this.uniqueEntityDetails(
              tenantId,
              'DESTINATION',
              timeRange,
              entityType
            ),
      ])

      const uniqueEntities = uniqBy(
        [...originEntities, ...destinationEntities],
        (entity) => entity
      )

      const mappedEntities = uniqueEntities.map((entity) => ({
        userKeyId: entity,
        value: entity,
        type: entityType,
      }))

      return this.createPaymentDetailsTask(
        aggregationVariable.type,
        mappedEntities
      )
    }

    throw new Error(
      `Unsupported aggregation variable type: ${aggregationVariable.type}`
    )
  }

  private isPaymentDetailsEntityType(type: string): boolean {
    return [
      'PAYMENT_DETAILS_ADDRESS',
      'PAYMENT_DETAILS_EMAIL',
      'PAYMENT_DETAILS_NAME',
    ].includes(type)
  }

  private getEntityTypeFromAggregationType(type: string): UserInfoTypes {
    const typeMap: Record<string, UserInfoTypes> = {
      PAYMENT_DETAILS_ADDRESS: 'ADDRESS',
      PAYMENT_DETAILS_EMAIL: 'EMAIL',
      PAYMENT_DETAILS_NAME: 'NAME',
    }
    return typeMap[type] || 'NAME'
  }

  private createPaymentDetailsTask(
    aggregationType: string,
    entities: Array<{ userKeyId: string; value: string; type: UserInfoTypes }>
  ): PreAggregationTask {
    const typeMap: Record<string, PreAggregationTask['type']> = {
      PAYMENT_DETAILS_ADDRESS: 'PAYMENT_DETAILS_ADDRESS',
      PAYMENT_DETAILS_EMAIL: 'PAYMENT_DETAILS_EMAIL',
      PAYMENT_DETAILS_NAME: 'PAYMENT_DETAILS_NAME',
    }

    return {
      ids: entities as any,
      type: typeMap[aggregationType] || 'PAYMENT_DETAILS_NAME',
    }
  }
}
