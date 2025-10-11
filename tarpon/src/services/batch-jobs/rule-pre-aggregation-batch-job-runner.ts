import compact from 'lodash/compact'
import floor from 'lodash/floor'
import isEmpty from 'lodash/isEmpty'
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
import { ClickhouseTransactionsRepository } from '../rules-engine/repositories/clickhouse-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import {
  TimestampSlice,
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
import { staticValueGenerator, zipGenerators } from '@/utils/generator'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { getClickhouseClient } from '@/utils/clickhouse/client'

const sqs = getSQSClient()

const DEFAULT_CHUNK_SIZE = 1000

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

@traceable
export class RulePreAggregationBatchJobRunner extends BatchJobRunner {
  private setDeduplicationIds = new Set<string>()
  private dynamoDb!: DynamoDBDocumentClient
  private mongoDb!: MongoClient
  private mongoTransactionsRepo!: MongoDbTransactionRepository
  private totalMessagesLength: number = 0
  private clickhouseTransactionsRepo!: ClickhouseTransactionsRepository
  private tenantId!: string
  protected async run(job: RulePreAggregationBatchJob): Promise<void> {
    this.dynamoDb = getDynamoDbClient()
    this.mongoDb = await getMongoDbClient()
    const tenantId = job.tenantId
    this.tenantId = tenantId
    const { entity, aggregationVariables, currentTimestamp } = job.parameters
    const ruleInstanceRepository = new RuleInstanceRepository(job.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    this.clickhouseTransactionsRepo = new ClickhouseTransactionsRepository(
      clickhouseClient,
      this.dynamoDb,
      this.tenantId
    )
    this.mongoTransactionsRepo = new MongoDbTransactionRepository(
      tenantId,
      this.mongoDb,
      this.dynamoDb
    )
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
    const dedupedAggregationVariables = uniqBy(
      aggregationVariables,
      getAggVarHash
    )
    for (const aggregationVariable of dedupedAggregationVariables) {
      // flush the set for each aggregation var to avoid bloating memory used
      this.setDeduplicationIds = new Set<string>()
      const preAggBuilder = this.preAggregateVariable(
        aggregationVariable,
        currentTimestamp
      )
      const timeRanges = this.splitAggregationWindow(
        aggregationVariable,
        currentTimestamp ?? Date.now(),
        tenantId
      )
      for await (const { ids, type } of preAggBuilder) {
        let messages: FifoSqsMessage[] = []
        if (type === 'USER_TRANSACTIONS') {
          messages = (ids as string[]).flatMap((userId) => {
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
          messages = (ids as PaymentDetailsUserInfo[]).flatMap(
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
          messages = (ids as PaymentDetailsAddressUserInfo[]).flatMap(
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
          messages = (ids as PaymentDetailsEmailUserInfo[]).flatMap(
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
          messages = (ids as PaymentDetailsNameUserInfo[]).flatMap(
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
      this.totalMessagesLength += this.setDeduplicationIds.size
    }

    if (this.totalMessagesLength === 0 && entity?.type === 'RULE') {
      logger.info(
        `No tasks to pre-aggregate. Switching rule instance ${entity.ruleInstanceId} to ACTIVE.`
      )
      await ruleInstanceRepository.updateRuleInstanceStatus(
        entity.ruleInstanceId,
        'ACTIVE'
      )
    }
    if (this.totalMessagesLength === 0 && entity?.type === 'RISK_FACTOR') {
      logger.info(
        `No tasks to pre-aggregate. Switching rule instance ${entity.riskFactorId} to ACTIVE.`
      )
      await riskRepository.updateRiskFactorStatus(entity.riskFactorId, 'ACTIVE')
    }
  }

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
      const messageSentStatusDict = await transientRepository.bulkCheckHasKey(
        this.jobId,
        dedupMessages.map((message) =>
          sanitizeDeduplicationId(message.MessageDeduplicationId)
        )
      )
      for (const message of dedupMessages) {
        if (
          !messageSentStatusDict[
            sanitizeDeduplicationId(message.MessageDeduplicationId)
          ]
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
          await transientRepository.batchAddKey(
            batch.map((message) => ({
              partitionKeyId: this.jobId,
              sortKeyId: (message.MessageDeduplicationId ?? '') as string,
            }))
          )
        }
      )
    }
  }

  private splitAggregationWindow(
    aggregationVar: LogicAggregationVariable,
    currentTimestamp: number,
    tenantId: string
  ): TimestampSlice[] | null {
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
        sliceNumber: index + 1,
      }
    })
  }

  private async *preAggregateVariable(
    aggregationVariable: LogicAggregationVariable,
    currentTimestamp: number = Date.now()
  ): AsyncGenerator<PreAggregationTask> {
    const { timeWindow } = aggregationVariable
    const timeRange = getTimeRangeByTimeWindows(
      currentTimestamp,
      timeWindow.start,
      timeWindow.end
    )
    if (aggregationVariable.type === 'USER_TRANSACTIONS') {
      const transactionsRepo = isClickhouseEnabled()
        ? this.clickhouseTransactionsRepo
        : this.mongoTransactionsRepo
      const originGenerator =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? staticValueGenerator<string[]>([])
          : transactionsRepo.getUniqueUserIdGenerator(
              'ORIGIN',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      const destinationGenerator =
        aggregationVariable.transactionDirection === 'SENDING'
          ? staticValueGenerator<string[]>([])
          : transactionsRepo.getUniqueUserIdGenerator(
              'DESTINATION',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      for await (const data of zipGenerators(
        originGenerator,
        destinationGenerator,
        []
      )) {
        const allUserIds = uniq(data[0].concat(data[1]))
        yield {
          ids: allUserIds,
          type: 'USER_TRANSACTIONS',
        }
      }
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_TRANSACTIONS') {
      const transactionsRepo = isClickhouseEnabled()
        ? this.clickhouseTransactionsRepo
        : this.mongoTransactionsRepo
      const originGenerator =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? staticValueGenerator<PaymentDetails[]>([])
          : transactionsRepo.getUniquePaymentDetailsGenerator(
              'ORIGIN',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      const destinationGenerator =
        aggregationVariable.transactionDirection === 'SENDING'
          ? staticValueGenerator<PaymentDetails[]>([])
          : transactionsRepo.getUniquePaymentDetailsGenerator(
              'DESTINATION',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      for await (const data of zipGenerators(
        originGenerator,
        destinationGenerator,
        []
      )) {
        const userInfos = compact(
          uniqBy(data[0].concat(data[1]), getPaymentDetailsIdentifiersKey).map(
            (v) => {
              const userKeyId = getPaymentDetailsIdentifiersKey(v)
              if (userKeyId) {
                return { userKeyId, paymentDetails: v }
              }
            }
          )
        )
        yield {
          ids: userInfos,
          type: 'PAYMENT_DETAILS_TRANSACTIONS',
        }
      }
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_ADDRESS') {
      const transactionsRepo = this.mongoTransactionsRepo
      const originGenerator =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? staticValueGenerator<Address[]>([])
          : transactionsRepo.getUniqueAddressDetailsGenerator(
              'ORIGIN',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      const destinationGenerator =
        aggregationVariable.transactionDirection === 'SENDING'
          ? staticValueGenerator<Address[]>([])
          : (
              transactionsRepo as MongoDbTransactionRepository
            ).getUniqueAddressDetailsGenerator(
              'DESTINATION',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      for await (const data of zipGenerators(
        originGenerator,
        destinationGenerator,
        []
      )) {
        const userInfos: PaymentDetailsAddressUserInfo[] = compact(
          uniqBy(data[0].concat(data[1]), (v) => generateChecksum(v, 10)).map(
            (v) => {
              const userKeyId = getAddressString(v)
              if (userKeyId) {
                return { userKeyId, address: v }
              }
            }
          )
        )
        yield {
          ids: userInfos,
          type: 'PAYMENT_DETAILS_ADDRESS',
        }
      }
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_EMAIL') {
      const transactionsRepo = this.mongoTransactionsRepo
      const originGenerator =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? staticValueGenerator<string[]>([])
          : transactionsRepo.getUniqueEmailDetailsGenerator(
              'ORIGIN',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      const destinationGenerator =
        aggregationVariable.transactionDirection === 'SENDING'
          ? staticValueGenerator<string[]>([])
          : (
              transactionsRepo as MongoDbTransactionRepository
            ).getUniqueEmailDetailsGenerator(
              'DESTINATION',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      for await (const data of zipGenerators(
        originGenerator,
        destinationGenerator,
        []
      )) {
        const userInfos: PaymentDetailsEmailUserInfo[] = compact(
          uniq(data[0].concat(data[1])).map((v) => {
            const userKeyId = v
            if (userKeyId) {
              return { userKeyId, email: v }
            }
          })
        )
        yield {
          ids: userInfos,
          type: 'PAYMENT_DETAILS_EMAIL',
        }
      }
    } else if (aggregationVariable.type === 'PAYMENT_DETAILS_NAME') {
      const transactionsRepo = this.mongoTransactionsRepo
      const originGenerator =
        aggregationVariable.transactionDirection === 'RECEIVING'
          ? staticValueGenerator<(ConsumerName | string)[]>([])
          : transactionsRepo.getUniqueNameDetailsGenerator(
              'ORIGIN',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      const destinationGenerator =
        aggregationVariable.transactionDirection === 'SENDING'
          ? staticValueGenerator<(ConsumerName | string)[]>([])
          : (
              transactionsRepo as MongoDbTransactionRepository
            ).getUniqueNameDetailsGenerator(
              'DESTINATION',
              timeRange,
              DEFAULT_CHUNK_SIZE
            )
      for await (const data of zipGenerators(
        originGenerator,
        destinationGenerator,
        []
      )) {
        const userInfos = compact(
          uniqBy(data[0].concat(data[1]), (v) =>
            typeof v === 'string' ? v : JSON.stringify(v)
          ).map((v) => {
            const userKeyId = typeof v === 'string' ? v : JSON.stringify(v)
            if (userKeyId) {
              return { userKeyId, name: v }
            }
          })
        )
        yield {
          ids: userInfos,
          type: 'PAYMENT_DETAILS_NAME',
        }
      }
    } else {
      throw new Error(
        `Unsupported aggregation variable type: ${aggregationVariable.type}`
      )
    }
  }
}
