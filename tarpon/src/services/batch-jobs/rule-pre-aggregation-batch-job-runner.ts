import chunk from 'lodash/chunk'
import compact from 'lodash/compact'
import floor from 'lodash/floor'
import isEmpty from 'lodash/isEmpty'
import memoize from 'lodash/memoize'
import range from 'lodash/range'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { getTimeRangeByTimeWindows } from '../rules-engine/utils/time-utils'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { getPaymentDetailsIdentifiersKey } from '../logic-evaluator/variables/payment-details'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import {
  getAggVarHash,
  TIME_SLICE_COUNT,
} from '../logic-evaluator/engine/aggregation-repository'
import {
  canAggregate,
  getAggregationGranularity,
} from '../logic-evaluator/engine/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import {
  TimestampRange,
  TransactionAggregationTaskEntry,
  V8LogicAggregationRebuildTask,
} from '@/@types/tranasction/aggregation'
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
import { TransientRepository } from '@/core/repositories/transient-repository'
import dayjs, { duration } from '@/utils/dayjs'
import { generateChecksum } from '@/utils/object'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { Address } from '@/@types/openapi-public/Address'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { getAddressString } from '@/utils/helpers'

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

type PaymentDetailsEntityUserInfo = {
  userKeyId: string
  type: UserInfoTypes
}

type PaymentDetailsAddressUserInfo = {
  userKeyId: string
  address: Address
}

type PaymentDetailsEmailUserInfo = {
  userKeyId: string
  email: string
}

type PaymentDetailsNameUserInfo = {
  userKeyId: string
  name: ConsumerName | string
}

type PreAggregationTask =
  | { type: 'USER_TRANSACTIONS'; ids: string[] }
  | { type: 'PAYMENT_DETAILS_TRANSACTIONS'; ids: PaymentDetailsUserInfo[] }
  | { type: 'PAYMENT_DETAILS_ADDRESS'; ids: PaymentDetailsAddressUserInfo[] }
  | { type: 'PAYMENT_DETAILS_EMAIL'; ids: PaymentDetailsEmailUserInfo[] }
  | { type: 'PAYMENT_DETAILS_NAME'; ids: PaymentDetailsNameUserInfo[] }

type UserInfoTypes = 'ADDRESS' | 'EMAIL' | 'NAME'

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
      mongoDb: this.mongoDb,
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
        | PaymentDetailsUserInfo
        | PaymentDetailsEntityUserInfo
        | string
        | PaymentDetailsAddressUserInfo
        | PaymentDetailsEmailUserInfo
        | PaymentDetailsNameUserInfo
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
        } else if (type === 'PAYMENT_DETAILS_ADDRESS') {
          messages = (idsChunk as PaymentDetailsAddressUserInfo[]).flatMap(
            ({ userKeyId, address }) => {
              return getAggregationTaskMessage({
                userKeyId,
                payload: {
                  type: 'PRE_AGGREGATION',
                  entityData: { type: 'ADDRESS', address },
                  tenantId: job.tenantId,
                  currentTimestamp: currentTimestamp ?? Date.now(),
                  jobId: this.jobId,
                  entity,
                  aggregationVariable,
                },
              })
            }
          )
        } else if (type === 'PAYMENT_DETAILS_EMAIL') {
          messages = (idsChunk as PaymentDetailsEmailUserInfo[]).flatMap(
            ({ userKeyId, email }) => {
              return getAggregationTaskMessage({
                userKeyId,
                payload: {
                  type: 'PRE_AGGREGATION',
                  entityData: { type: 'EMAIL', email },
                  tenantId: job.tenantId,
                  currentTimestamp: currentTimestamp ?? Date.now(),
                  jobId: this.jobId,
                  entity,
                  aggregationVariable,
                },
              })
            }
          )
        } else if (type === 'PAYMENT_DETAILS_NAME') {
          messages = (idsChunk as PaymentDetailsNameUserInfo[]).flatMap(
            ({ userKeyId, name }) => {
              return getAggregationTaskMessage({
                userKeyId,
                payload: {
                  type: 'PRE_AGGREGATION',
                  entityData: { type: 'NAME', name },
                  tenantId: job.tenantId,
                  currentTimestamp: currentTimestamp ?? Date.now(),
                  jobId: this.jobId,
                  entity,
                  aggregationVariable,
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
        this.mongoDb,
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
        this.mongoDb,
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

  private uniqueAddressDetails = memoize(
    async (
      tenantId: string,
      direction: 'ORIGIN' | 'DESTINATION',
      timeRange: { afterTimestamp: number; beforeTimestamp: number }
    ) => {
      const transactionsRepo = new MongoDbTransactionRepository(
        tenantId,
        this.mongoDb,
        this.dynamoDb
      )
      return await transactionsRepo.getUniqueAddressDetails(
        direction,
        timeRange
      )
    },
    (tenantId, direction, timeRange) =>
      `${tenantId}-${direction}-${timeRange.afterTimestamp}-${timeRange.beforeTimestamp}`
  )

  private uniqueEmailDetails = memoize(
    async (
      tenantId: string,
      direction: 'ORIGIN' | 'DESTINATION',
      timeRange: { afterTimestamp: number; beforeTimestamp: number }
    ) => {
      const transactionsRepo = new MongoDbTransactionRepository(
        tenantId,
        this.mongoDb,
        this.dynamoDb
      )
      return await transactionsRepo.getUniqueEmailDetails(direction, timeRange)
    },
    (tenantId, direction, timeRange) =>
      `${tenantId}-${direction}-${timeRange.afterTimestamp}-${timeRange.beforeTimestamp}`
  )

  private uniqueNameDetails = memoize(
    async (
      tenantId: string,
      direction: 'ORIGIN' | 'DESTINATION',
      timeRange: { afterTimestamp: number; beforeTimestamp: number }
    ) => {
      const transactionsRepo = new MongoDbTransactionRepository(
        tenantId,
        this.mongoDb,
        this.dynamoDb
      )
      return await transactionsRepo.getUniqueNameDetails(direction, timeRange)
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

    await this.jobRepository.incrementMetadataTasksCount(
      this.jobId,
      dedupMessages.length
    )

    if (envIs('local')) {
      const { handleV8PreAggregationTasks } = await import(
        '@/core/local-handlers/v8-pre-aggregation'
      )

      await handleV8PreAggregationTasks(dedupMessages)
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
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_ADDRESS') {
      const originPaymentDetails =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? []
          : await this.uniqueAddressDetails(tenantId, 'ORIGIN', timeRange)
      const destinationPaymentDetails =
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : await this.uniqueAddressDetails(tenantId, 'DESTINATION', timeRange)
      const userInfos: PaymentDetailsAddressUserInfo[] = compact(
        uniqBy(originPaymentDetails.concat(destinationPaymentDetails), (v) =>
          generateChecksum(v, 10)
        ).map((v) => {
          const userKeyId = getAddressString(v)
          if (userKeyId) {
            return { userKeyId, address: v }
          }
        })
      )
      return {
        ids: userInfos,
        type: 'PAYMENT_DETAILS_ADDRESS',
      }
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_EMAIL') {
      const originPaymentDetails =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? []
          : await this.uniqueEmailDetails(tenantId, 'ORIGIN', timeRange)
      const destinationPaymentDetails =
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : await this.uniqueEmailDetails(tenantId, 'DESTINATION', timeRange)
      const userInfos: PaymentDetailsEmailUserInfo[] = compact(
        uniq(originPaymentDetails.concat(destinationPaymentDetails)).map(
          (v) => {
            const userKeyId = v
            if (userKeyId) {
              return { userKeyId, email: v }
            }
          }
        )
      )
      return {
        ids: userInfos,
        type: 'PAYMENT_DETAILS_EMAIL',
      }
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_NAME') {
      const originPaymentDetails =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? []
          : await this.uniqueNameDetails(tenantId, 'ORIGIN', timeRange)
      const destinationPaymentDetails =
        aggregationVariable.transactionDirection === 'SENDING'
          ? []
          : await this.uniqueNameDetails(tenantId, 'DESTINATION', timeRange)
      const userInfos = compact(
        uniqBy(originPaymentDetails.concat(destinationPaymentDetails), (v) =>
          typeof v === 'string' ? v : JSON.stringify(v)
        ).map((v) => {
          const userKeyId = typeof v === 'string' ? v : JSON.stringify(v)
          if (userKeyId) {
            return { userKeyId, name: v }
          }
        })
      )
      return {
        ids: userInfos,
        type: 'PAYMENT_DETAILS_NAME',
      }
    }

    throw new Error(
      `Unsupported aggregation variable type: ${aggregationVariable.type}`
    )
  }
}
