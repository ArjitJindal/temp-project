import createHttpError from 'http-errors'
import { compact, groupBy, uniqBy } from 'lodash'
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
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { hasFeature } from '@/core/utils/context'
import { logger } from '@/core/logger'
import {
  bulkSendMessages,
  FifoSqsMessage,
  getSQSClient,
  sanitizeDeduplicationId,
} from '@/utils/sns-sqs-client'
import { envIs } from '@/utils/env'
import { UserTag } from '@/@types/openapi-internal/all'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { UserType } from '@/@types/user/user-type'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionRiskScoringResult } from '@/@types/openapi-public/TransactionRiskScoringResult'
import { generateChecksum } from '@/utils/object'

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

export function getSenderKeyId(
  tenantId: string,
  transaction: Transaction,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
): string | undefined {
  return getSenderKeys(tenantId, transaction, undefined, options)
    ?.PartitionKeyID
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
  return getReceiverKeys(tenantId, transaction, undefined, options)
    ?.PartitionKeyID
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
  if (hasFeature('MANUAL_PRE_AGGREGATION')) {
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
  return {
    hitRules: includeInternal ? hitRules : filterOutInternalRules(hitRules),
    executedRules: includeInternal
      ? executedRules
      : filterOutInternalRules(executedRules),
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
  messages: FifoSqsMessage[]
) {
  if (envIs('local', 'test')) {
    const {
      handleTransactionAggregationTask,
      handleV8TransactionAggregationTask,
    } = await import('@/lambdas/transaction-aggregation/app')
    for (const message of messages) {
      const payload = JSON.parse(message.MessageBody)
      if (payload.type === 'TRANSACTION_AGGREGATION') {
        await handleV8TransactionAggregationTask(payload)
      } else {
        await handleTransactionAggregationTask(payload)
      }
    }
  } else {
    const finalMessages = [...messages]
    await bulkSendMessages(
      sqs,
      process.env.TRANSACTION_AGGREGATION_QUEUE_URL as string,
      uniqBy(finalMessages, 'MessageDeduplicationId')
    )
    logger.debug(`Sent transaction aggregation tasks to SQS`)
  }
}

type AsyncRuleRecordTransaction = {
  type: 'TRANSACTION'
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  riskDetails?: TransactionRiskScoringResult
  backfillNamespace?: string
}
type AsyncRuleRecordTransactionBatch = {
  type: 'TRANSACTION_BATCH'
  transaction: Transaction
}

type AsyncRuleRecordTransactionEvent = {
  type: 'TRANSACTION_EVENT'
  updatedTransaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
  transactionEventId: string
}

type AsyncRuleRecordTransactionEventBatch = {
  type: 'TRANSACTION_EVENT_BATCH'
  transactionEvent: TransactionEvent
}

type AsyncRuleRecordUser = {
  type: 'USER'
  userType: UserType
  user: User | Business
}
type AsyncRuleRecordUserBatch = {
  type: 'USER_BATCH'
  userType: UserType
  user: User | Business
}

type AsyncRuleRecordUserEvent = {
  type: 'USER_EVENT'
  updatedUser: User | Business
  userEventTimestamp: number
  userType: UserType
}
type AsyncRuleRecordUserEventBatch = {
  type: 'USER_EVENT_BATCH'
  userType: UserType
  userEvent: ConsumerUserEvent | BusinessUserEvent
}
export type AsyncRuleRecord = (
  | AsyncRuleRecordTransaction
  | AsyncRuleRecordTransactionEvent
  | AsyncRuleRecordUser
  | AsyncRuleRecordUserEvent
  | AsyncRuleRecordTransactionBatch
  | AsyncRuleRecordTransactionEventBatch
  | AsyncRuleRecordUserBatch
  | AsyncRuleRecordUserEventBatch
) & {
  tenantId: string
}
function getAsyncRuleMessageGroupId(record: AsyncRuleRecord): string {
  switch (record.type) {
    case 'TRANSACTION':
      return compact([
        record.transaction.originUserId,
        record.transaction.destinationUserId,
        record.tenantId,
      ])[0]
    case 'TRANSACTION_EVENT':
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
      // TODO: To improve this
      return record.tenantId
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
  tasks: AsyncRuleRecord[]
): Promise<void> {
  if (envIs('test', 'local')) {
    const { asyncRuleRunnerHandler } = await import('@/lambdas/async-rule/app')
    if (envIs('local') || process.env.__ASYNC_RULES_IN_SYNC_TEST__ === 'true') {
      await asyncRuleRunnerHandler({
        Records: tasks.map((task) => ({
          body: JSON.stringify(task),
        })),
      })
    }
    return
  }

  const isConcurrentAsyncRulesEnabled = hasFeature('CONCURRENT_ASYNC_RULES')

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
      return {
        MessageBody: JSON.stringify(task),
        QueueUrl: process.env.ASYNC_RULE_QUEUE_URL,
        MessageGroupId: generateChecksum(
          isConcurrentAsyncRulesEnabled
            ? getAsyncRuleMessageGroupId(task)
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
      return {
        MessageBody: JSON.stringify(task),
        QueueUrl: process.env.BATCH_ASYNC_RULE_QUEUE_URL,
        MessageGroupId: generateChecksum(
          isConcurrentAsyncRulesEnabled
            ? getAsyncRuleMessageGroupId(task)
            : task.tenantId,
          10
        ),
        MessageDeduplicationId: messageDeduplicationId,
      }
    })

  await Promise.all([
    bulkSendMessages(sqs, process.env.ASYNC_RULE_QUEUE_URL as string, messages),
    bulkSendMessages(
      sqs,
      process.env.BATCH_ASYNC_RULE_QUEUE_URL as string,
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
