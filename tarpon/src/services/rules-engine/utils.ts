import createHttpError from 'http-errors'
import compact from 'lodash/compact'
import groupBy from 'lodash/groupBy'
import uniqBy from 'lodash/uniqBy'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { filterOutInternalRules } from './pnb-custom-logic'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RiskLevelRuleActions } from '@/@types/openapi-internal/RiskLevelRuleActions'
import { RiskLevelRuleParameters } from '@/@types/openapi-internal/RiskLevelRuleParameters'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { hasFeature } from '@/core/utils/context'
import { logger } from '@/core/logger'
import {
  bulkSendMessages,
  FifoSqsMessage,
  getSQSClient,
  getSQSQueueUrl,
  sanitizeDeduplicationId,
} from '@/utils/sns-sqs-client'
import { envIs } from '@/utils/env'
import { UserTag } from '@/@types/openapi-internal/all'
import { generateChecksum } from '@/utils/object'
import {
  AsyncRuleRecordTransaction,
  AsyncRuleRecordTransactionEvent,
  AsyncRuleRecord,
} from '@/@types/batch-import'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import {
  getPaymentDetailsName,
  getPaymentEmailId,
  getPaymentMethodAddress,
} from '@/utils/payment-details'
import { isDemoTenant } from '@/utils/tenant-id'
import { sanitiseBucketedKey } from '@/core/dynamodb/key-utils'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { getMongoDbClient } from '@/utils/mongodb-utils'

export function getSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
): { PartitionKeyID: string; SortKeyID: string } | undefined | null {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    options?.matchPaymentDetails ? undefined : transaction.originUserId,
    transaction.originPaymentDetails,
    options?.disableDirection ? 'all' : 'sending',
    transactionType,
    {
      timestamp: transaction.timestamp,
      transactionId: transaction.transactionId,
    }
  )
}

export function getSendingEntityKeys(
  tenantId: string,
  transaction: Transaction,
  paymentDetails?: PaymentDetails
): { PartitionKeyID: string; SortKeyID: string }[] {
  if (!paymentDetails) {
    return []
  }
  const address = getPaymentMethodAddress(paymentDetails)
  const email = getPaymentEmailId(paymentDetails)
  const name = getPaymentDetailsName(paymentDetails)
  return compact([
    address
      ? DynamoDbKeys.ADDRESS_TRANSACTION(tenantId, address, 'sending', {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        })
      : undefined,
    email
      ? DynamoDbKeys.EMAIL_TRANSACTION(tenantId, email, 'sending', {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        })
      : undefined,
    name
      ? DynamoDbKeys.NAME_TRANSACTION(tenantId, name, 'sending', {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        })
      : undefined,
  ])
}

export function getReceivingEntityKeys(
  tenantId: string,
  transaction: Transaction,
  paymentDetails?: PaymentDetails
): { PartitionKeyID: string; SortKeyID: string }[] {
  if (!paymentDetails) {
    return []
  }
  const address = getPaymentMethodAddress(paymentDetails)
  const email = getPaymentEmailId(paymentDetails)
  const name = getPaymentDetailsName(paymentDetails)
  return compact([
    address
      ? DynamoDbKeys.ADDRESS_TRANSACTION(tenantId, address, 'receiving', {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        })
      : undefined,
    email
      ? DynamoDbKeys.EMAIL_TRANSACTION(tenantId, email, 'receiving', {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        })
      : undefined,
    name
      ? DynamoDbKeys.NAME_TRANSACTION(tenantId, name, 'receiving', {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        })
      : undefined,
  ])
}

export function getSenderKeyId(
  tenantId: string,
  transaction: Transaction,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
): string | undefined {
  return sanitiseBucketedKey(
    getSenderKeys(tenantId, transaction, undefined, options)?.PartitionKeyID
  )
}

export function getUserSenderKeyId(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): string | undefined {
  return sanitiseBucketedKey(
    getUserSenderKeys(tenantId, transaction, transactionType)?.PartitionKeyID
  )
}

export function getUserSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.originUserId
    ? DynamoDbKeys.USER_TRANSACTION(
        tenantId,
        transaction.originUserId,
        'sending',
        transactionType,
        {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        }
      )
    : null
}

export function getNonUserSenderKeyId(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  disableDirection?: boolean
): string | undefined {
  return sanitiseBucketedKey(
    getNonUserSenderKeys(
      tenantId,
      transaction,
      transactionType,
      disableDirection
    )?.PartitionKeyID
  )
}

export function getNonUserSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  disableDirection?: boolean
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.originPaymentDetails
    ? DynamoDbKeys.NON_USER_TRANSACTION(
        tenantId,
        transaction.originPaymentDetails,
        disableDirection ? 'all' : 'sending',
        transactionType,
        {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        }
      )
    : null
}

export function getReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
):
  | {
      PartitionKeyID: string
      SortKeyID: string
    }
  | undefined
  | null {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    options?.matchPaymentDetails ? undefined : transaction.destinationUserId,
    transaction.destinationPaymentDetails,
    options?.disableDirection ? 'all' : 'receiving',
    transactionType,
    {
      timestamp: transaction.timestamp,
      transactionId: transaction.transactionId,
    }
  )
}

export function getReceiverKeyId(
  tenantId: string,
  transaction: Transaction,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
): string | undefined {
  return sanitiseBucketedKey(
    getReceiverKeys(tenantId, transaction, undefined, options)?.PartitionKeyID
  )
}

export function getUserReceiverKeyId(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): string | undefined {
  return sanitiseBucketedKey(
    getUserReceiverKeys(tenantId, transaction, transactionType)?.PartitionKeyID
  )
}

export function getUserReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.destinationUserId
    ? DynamoDbKeys.USER_TRANSACTION(
        tenantId,
        transaction.destinationUserId,
        'receiving',
        transactionType,
        {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        }
      )
    : null
}

export function getNonUserReceiverKeyId(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  disableDirection?: boolean
): string | undefined {
  return sanitiseBucketedKey(
    getNonUserReceiverKeys(
      tenantId,
      transaction,
      transactionType,
      disableDirection
    )?.PartitionKeyID
  )
}

export function getNonUserReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  disableDirection?: boolean
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.destinationPaymentDetails
    ? DynamoDbKeys.NON_USER_TRANSACTION(
        tenantId,
        transaction.destinationPaymentDetails,
        disableDirection ? 'all' : 'receiving',
        transactionType,
        {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        }
      )
    : null
}

export function getAggregatedRuleStatus(
  hitRules: HitRulesDetails[]
): RuleAction {
  const ruleActions = filterLiveRules({ hitRules }).hitRules.map(
    (hitRule) => hitRule.ruleAction
  )

  return ruleActions.reduce((prev, curr) => {
    if (RULE_ACTIONS.indexOf(curr) < RULE_ACTIONS.indexOf(prev)) {
      return curr
    } else {
      return prev
    }
  }, 'ALLOW')
}

export function isV8RuleInstance(ruleInstance: RuleInstance): boolean {
  if (ruleInstance.logic || ruleInstance.riskLevelLogic) {
    if (hasFeature('RULES_ENGINE_V8_FOR_V2_RULES') && ruleInstance.ruleId) {
      return !!ruleInstance.ruleId?.startsWith('RC')
    }

    return true
  }

  return false
}

export function isV8Rule(rule: Rule): boolean {
  return !!rule.defaultLogic
}

export function isV2RuleInstance(ruleInstance: RuleInstance): boolean {
  return !!(ruleInstance.ruleId && !ruleInstance.ruleId.startsWith('RC'))
}

export function isV2ScreeningRule(ruleInstance: RuleInstance): boolean {
  return ruleInstance.nature === 'SCREENING' && isV2RuleInstance(ruleInstance)
}

export function runOnV8Engine(ruleInstance: RuleInstance): boolean {
  if (hasFeature('RULES_ENGINE_V8')) {
    if (envIs('test')) {
      return true
    }

    if (hasFeature('RULES_ENGINE_V8_FOR_V2_RULES')) {
      return true
    }

    if (!isV2RuleInstance(ruleInstance)) {
      return true
    }
  }
  return false
}

export async function ruleInstanceAggregationVariablesRebuild(
  ruleInstance: RuleInstance,
  comparisonTime: number,
  tenantId: string,
  ruleInstanceRepository: RuleInstanceRepository,
  options?: { updateRuleInstanceStatus?: boolean }
) {
  if (hasFeature('MANUAL_PRE_AGGREGATION') || isDemoTenant(tenantId)) {
    return
  }
  const aggVarsToRebuild =
    ruleInstance.logicAggregationVariables?.filter(
      (aggVar) => aggVar.version && aggVar.version >= comparisonTime
    ) ?? []
  const updateRuleInstanceStatus = options?.updateRuleInstanceStatus ?? true

  if (aggVarsToRebuild.length > 0) {
    if (updateRuleInstanceStatus) {
      await ruleInstanceRepository.updateRuleInstanceStatus(
        ruleInstance.id as string,
        'DEPLOYING'
      )
      logger.info(
        `Updated rule instance status to DEPLOYING: ${ruleInstance.id}`
      )
    }
    await sendBatchJobCommand({
      type: 'RULE_PRE_AGGREGATION',
      tenantId: tenantId,
      parameters: {
        entity: {
          type: 'RULE',
          ruleInstanceId: ruleInstance.id as string,
        },
        aggregationVariables: aggVarsToRebuild,
      },
    })
    logger.info(
      `Created rule pre-aggregation job for rule instance: ${ruleInstance.id}`
    )
  }
}

export function assertValidRiskLevelParameters(
  riskLevelRuleActions?: RiskLevelRuleActions,
  riskLevelRuleParameters?: RiskLevelRuleParameters
) {
  if (
    (!riskLevelRuleActions && riskLevelRuleParameters) ||
    (riskLevelRuleActions && !riskLevelRuleParameters)
  ) {
    throw new createHttpError.BadRequest(
      'Risk-level rule actions and risk-level rule parameters should coexist'
    )
  }
}

type Executions = {
  hitRules: HitRulesDetails[]
  executedRules: ExecutedRulesResult[]
}

function filterOutSanctionsDetails(
  executedRules: ExecutedRulesResult[]
): ExecutedRulesResult[] {
  return executedRules.map((rule) => ({
    ...rule,
    sanctionsDetails: undefined,
  }))
}

export function filterLiveRules(
  executions: Partial<Executions>,
  includeInternal = false
): Executions {
  const hitRules =
    executions.hitRules?.filter((hitRule) => !hitRule.isShadow) ?? []
  const executedRules =
    executions.executedRules?.filter(
      (executedRule) => !executedRule.isShadow
    ) ?? []

  const filteredExecutedRules = includeInternal
    ? executedRules
    : filterOutInternalRules(executedRules)
  return {
    hitRules: includeInternal ? hitRules : filterOutInternalRules(hitRules),
    executedRules: filterOutSanctionsDetails(filteredExecutedRules),
  }
}

export function isShadowRule(ruleInstance: RuleInstance): boolean {
  return (
    ruleInstance.mode?.includes('SHADOW') ||
    ruleInstance.ruleRunMode === 'SHADOW'
  )
}

export function isAsyncRule(ruleInstance: RuleInstance): boolean {
  return (
    ruleInstance.mode?.includes('ASYNC') ||
    ruleInstance.ruleExecutionMode === 'ASYNC'
  )
}

export function isSyncRule(ruleInstance: RuleInstance): boolean {
  return !isAsyncRule(ruleInstance)
}

const sqs = getSQSClient()

export async function sendTransactionAggregationTasks(
  messages: FifoSqsMessage[],
  dynamoDb: DynamoDBDocumentClient,
  mongoDb?: MongoClient
) {
  if (envIs('local', 'test')) {
    const { handleTransactionAggregationTasks } = await import(
      '@/core/local-handlers/transaction-aggregation'
    )
    mongoDb = mongoDb ?? (await getMongoDbClient())
    await handleTransactionAggregationTasks(messages, dynamoDb, mongoDb)
  } else {
    const finalMessages = [...messages]
    await bulkSendMessages(
      sqs,
      getSQSQueueUrl(process.env.TRANSACTION_AGGREGATION_QUEUE_URL as string),
      uniqBy(finalMessages, 'MessageDeduplicationId')
    )
    logger.debug(`Sent transaction aggregation tasks to SQS`)
  }
}

function getGroupIdForGcTxAndTxEvent(
  record: (AsyncRuleRecordTransaction | AsyncRuleRecordTransactionEvent) & {
    tenantId: string
  }
) {
  let userId: string | undefined
  const accessor =
    record.type === 'TRANSACTION' ? 'transaction' : 'updatedTransaction'
  if (record.senderUser) {
    userId = record[accessor].originUserId
  } else if (record.receiverUser) {
    userId = record[accessor].destinationUserId
  }
  return userId ?? record.tenantId
}

function getAsyncRuleMessageGroupId(
  record: AsyncRuleRecord,
  isGc: boolean
): string {
  switch (record.type) {
    case 'TRANSACTION':
      if (isGc) {
        return getGroupIdForGcTxAndTxEvent(record)
      }
      return compact([
        record.transaction.originUserId,
        record.transaction.destinationUserId,
        record.tenantId,
      ])[0]
    case 'TRANSACTION_EVENT':
      if (isGc) {
        return getGroupIdForGcTxAndTxEvent(record)
      }
      return compact([
        record.updatedTransaction.originUserId,
        record.updatedTransaction.destinationUserId,
        record.tenantId,
      ])[0]
    case 'TRANSACTION_BATCH':
      return compact([
        record.transaction.originUserId,
        record.transaction.destinationUserId,
        record.tenantId,
      ])[0]
    case 'TRANSACTION_EVENT_BATCH':
      return compact([
        record.originUserId,
        record.destinationUserId,
        record.tenantId,
      ])[0]
    case 'USER':
      return record.user.userId
    case 'USER_EVENT':
      return record.updatedUser.userId
    case 'USER_BATCH':
      return record.user.userId
    case 'USER_EVENT_BATCH':
      return record.userEvent.userId
  }
}

export async function sendAsyncRuleTasks(
  tasks: AsyncRuleRecord[],
  secondaryQueue: boolean = false,
  saveBatchEntities: boolean = true
): Promise<void> {
  if (envIs('test', 'local')) {
    const { handleLocalAsyncRuleTasks } = await import(
      '@/core/local-handlers/async-rules'
    )

    await handleLocalAsyncRuleTasks(tasks, saveBatchEntities)
    return
  }

  const isConcurrentAsyncRulesEnabled = hasFeature('CONCURRENT_ASYNC_RULES')
  const isMultiplexed = hasFeature('MULTIPLEX_ASYNC_RULES_TX')
  const messages = tasks
    .filter((task) => !task.type.endsWith('_BATCH'))
    .map((task) => {
      let messageDeduplicationId = ''
      if (task.type === 'TRANSACTION') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `T-${task.transaction.transactionId}`
        )
      } else if (task.type === 'TRANSACTION_EVENT') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `TE-${task.transactionEventId}`
        )
      } else if (task.type === 'USER') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `U-${task.user.userId}`
        )
      } else if (task.type === 'USER_EVENT') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `UE-${task.updatedUser.userId}-${task.userEventTimestamp}`
        )
      }
      if (
        isMultiplexed &&
        (task.type === 'TRANSACTION_EVENT' || task.type === 'TRANSACTION')
      ) {
        return {
          MessageBody: JSON.stringify(task),
          QueueUrl: getSQSQueueUrl(
            process.env.HIGH_TRAFFIC_ASYNC_RULE_QUEUE_URL
          ), // Currently only sending to HIGH_TRAFFIC queue (ToDo: Have system to keep tenants in high traffic or low traffic)
          MessageGroupId: generateChecksum(task.tenantId),
          MessageDeduplicationId: messageDeduplicationId,
        }
      }
      return {
        MessageBody: JSON.stringify(task),
        QueueUrl: secondaryQueue
          ? getSQSQueueUrl(process.env.SECONDARY_ASYNC_RULE_QUEUE_URL)
          : getSQSQueueUrl(process.env.ASYNC_RULE_QUEUE_URL),
        MessageGroupId: generateChecksum(
          isConcurrentAsyncRulesEnabled
            ? getAsyncRuleMessageGroupId(task, task.tenantId === '4c9cdf0251')
            : task.tenantId,
          10
        ),
        MessageDeduplicationId: messageDeduplicationId,
      }
    })

  const batchMessages = tasks
    .filter((task) => task.type.endsWith('_BATCH'))
    .map((task) => {
      let messageDeduplicationId = ''
      if (task.type === 'TRANSACTION_BATCH') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `TB-${task.transaction.transactionId}`
        )
      } else if (task.type === 'TRANSACTION_EVENT_BATCH') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `TEB-${task.transactionEvent.transactionId}-${
            task.transactionEvent.eventId ?? task.transactionEvent.timestamp
          }`
        )
      } else if (task.type === 'USER_BATCH') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `UB-${task.user.userId}`
        )
      } else if (task.type === 'USER_EVENT_BATCH') {
        messageDeduplicationId = sanitizeDeduplicationId(
          `UEB-${task.userEvent.userId}-${
            task.userEvent.eventId ?? task.userEvent.timestamp
          }`
        )
      }
      const messageGroupId = isConcurrentAsyncRulesEnabled
        ? getAsyncRuleMessageGroupId(task, task.tenantId === '4c9cdf0251')
        : task.tenantId
      return {
        MessageBody: JSON.stringify(task),
        QueueUrl: getSQSQueueUrl(process.env.BATCH_ASYNC_RULE_QUEUE_URL),
        MessageGroupId: generateChecksum(messageGroupId, 10),
        MessageDeduplicationId: messageDeduplicationId,
      }
    })

  await Promise.all([
    bulkSendMessages(
      sqs,
      secondaryQueue
        ? getSQSQueueUrl(process.env.SECONDARY_ASYNC_RULE_QUEUE_URL as string)
        : getSQSQueueUrl(process.env.ASYNC_RULE_QUEUE_URL as string),
      messages
    ),
    bulkSendMessages(
      sqs,
      getSQSQueueUrl(process.env.BATCH_ASYNC_RULE_QUEUE_URL as string),
      batchMessages
    ),
  ])
}

export function mergeUserTags(
  previousTags?: UserTag[],
  updatedTags?: UserTag[]
) {
  if (!previousTags || !updatedTags) {
    return previousTags ?? updatedTags
  }
  let newTagsToUpdate: UserTag[] = []
  const prevTags = groupBy(previousTags ?? [], 'key')
  const newTags = groupBy(updatedTags ?? [], 'key')
  newTagsToUpdate = Object.keys(prevTags).flatMap((key) => {
    if (newTags[key]?.length) {
      const newTag = newTags[key]
      delete newTags[key]
      return newTag
    }
    return prevTags[key]
  })
  Object.keys(newTags).forEach((key) => {
    newTagsToUpdate?.push(...newTags[key])
  })
  return newTagsToUpdate
}
