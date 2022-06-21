/* eslint-disable @typescript-eslint/no-var-requires */
import * as _ from 'lodash'
import { NotFound } from 'http-errors'
import { UserRepository } from '../users/repositories/user-repository'
import { Aggregators } from './aggregator'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleRepository } from './repositories/rule-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { TRANSACTION_RULES } from './transaction-rules'
import { Rule as RuleBase } from './rule'
import { USER_RULES } from './user-rules'
import { UserEventRepository } from './repositories/user-event-repository'
import { TransactionEventRepository } from './repositories/transaction-event-repository'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { Rule } from '@/@types/openapi-internal/Rule'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { everyAsync } from '@/core/utils/array'
import { UserEvent } from '@/@types/openapi-public/UserEvent'
import { UserMonitoringResult } from '@/@types/openapi-public/UserMonitoringResult'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { HitRulesResult } from '@/@types/openapi-public/HitRulesResult'
import { TransactionEventMonitoringResult } from '@/@types/openapi-public/TransactionEventMonitoringResult'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

const ruleAscendingComparator = (
  rule1: HitRulesResult,
  rule2: HitRulesResult
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

function getTransactionRuleImplementation(
  ruleImplementationName: string,
  tenantId: string,
  transaction: Transaction,
  senderUser: InternalConsumerUser | InternalBusinessUser | undefined,
  receiverUser: InternalConsumerUser | InternalBusinessUser | undefined,
  ruleParameters: object,
  ruleAction: RuleAction,
  dynamoDb: AWS.DynamoDB.DocumentClient
) {
  const RuleClass = TRANSACTION_RULES[ruleImplementationName]
  if (!RuleClass) {
    throw new Error(`${ruleImplementationName} rule implementation not found!`)
  }
  return new RuleClass(
    tenantId,
    { transaction, senderUser, receiverUser },
    { parameters: ruleParameters, action: ruleAction },
    dynamoDb
  )
}

export async function verifyTransactionIdempotent(
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient,
  transaction: Transaction
): Promise<{
  executedRules: ExecutedRulesResult[]
  hitRules: HitRulesResult[]
}> {
  const ruleRepository = new RuleRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const userRepository = new UserRepository(tenantId, {
    dynamoDb,
  })

  const [senderUser, receiverUser, ruleInstances] = await Promise.all([
    transaction.originUserId
      ? userRepository.getUser<InternalConsumerUser | InternalBusinessUser>(
          transaction.originUserId
        )
      : undefined,
    transaction.destinationUserId
      ? userRepository.getUser<InternalConsumerUser | InternalBusinessUser>(
          transaction.destinationUserId
        )
      : undefined,
    ruleInstanceRepository.getActiveRuleInstances('TRANSACTION'),
  ])

  return getRulesResult(
    ruleRepository,
    ruleInstanceRepository,
    ruleInstances,
    (ruleImplementationName, ruleInstance) =>
      getTransactionRuleImplementation(
        ruleImplementationName,
        tenantId,
        transaction,
        senderUser,
        receiverUser,
        ruleInstance.parameters,
        ruleInstance.action,
        dynamoDb
      )
  )
}

export async function verifyTransaction(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<TransactionMonitoringResult> {
  const transactionRepository = new TransactionRepository(tenantId, {
    dynamoDb,
  })
  const transactionEventRepository = new TransactionEventRepository(tenantId, {
    dynamoDb,
  })

  if (transaction.transactionId) {
    const existingTransaction = await transactionRepository.getTransactionById(
      transaction.transactionId
    )
    if (existingTransaction) {
      return {
        transactionId: transaction.transactionId,
        executedRules: existingTransaction.executedRules,
        hitRules: existingTransaction.hitRules,
      }
    }
  }

  const { executedRules, hitRules } = await verifyTransactionIdempotent(
    tenantId,
    dynamoDb,
    transaction
  )
  const savedTransaction = await transactionRepository.saveTransaction(
    {
      ...transaction,
      transactionState: transaction.transactionState || 'CREATED',
    },
    {
      executedRules,
      hitRules,
    }
  )

  await transactionEventRepository.saveTransactionEvent(
    {
      transactionId: savedTransaction.transactionId as string,
      timestamp: savedTransaction.timestamp as number,
      transactionState: 'CREATED',
      updatedTransactionAttributes: savedTransaction,
    },
    {
      executedRules,
      hitRules,
    }
  )

  await updateAggregation(tenantId, savedTransaction, dynamoDb)

  return {
    transactionId: savedTransaction.transactionId as string,
    executedRules,
    hitRules,
  }
}

export async function verifyTransactionEvent(
  transactionEvent: TransactionEvent,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<TransactionEventMonitoringResult> {
  const transactionRepository = new TransactionRepository(tenantId, {
    dynamoDb,
  })
  const transactionEventRepository = new TransactionEventRepository(tenantId, {
    dynamoDb,
  })
  const transaction = await transactionRepository.getTransactionById(
    transactionEvent.transactionId
  )
  if (!transaction) {
    throw new NotFound(
      `transaction ${transactionEvent.transactionId} not found`
    )
  }

  const hasTransactionUpdates = !_.isNil(
    transactionEvent.updatedTransactionAttributes
  )
  const updatedTransaction: TransactionWithRulesResult = {
    ...transaction,
    transactionState: transactionEvent.transactionState,
    ...(transactionEvent.updatedTransactionAttributes || {}),
  }
  const { executedRules, hitRules } = await verifyTransactionIdempotent(
    tenantId,
    dynamoDb,
    updatedTransaction
  )

  const eventId = await transactionEventRepository.saveTransactionEvent(
    transactionEvent,
    {
      executedRules,
      hitRules,
    }
  )

  // Update transaction with the latest payload
  await transactionRepository.saveTransaction(updatedTransaction, {
    executedRules,
    hitRules,
  })

  // For duplicated transaction events with the same state, we don't re-aggregated
  // but this won't prevent re-aggregation if we have the states like [CREATED, APPROVED, CREATED]
  if (transaction.transactionState !== updatedTransaction.transactionState) {
    await updateAggregation(tenantId, updatedTransaction, dynamoDb)
  }
  const updatedTransactionWithoutRulesResult = {
    ...updatedTransaction,
    executedRules: undefined,
    hitRules: undefined,
  }

  return {
    eventId,
    transaction: updatedTransactionWithoutRulesResult,
    executedRules,
    hitRules,
  }
}

export async function updateAggregation(
  tenantId: string,
  transaction: Transaction,
  dynamoDb: AWS.DynamoDB.DocumentClient
) {
  await Promise.all(
    Aggregators.map(async (Aggregator) => {
      try {
        const aggregator = new Aggregator(tenantId, transaction, dynamoDb)
        if (aggregator.shouldAggregate()) {
          await aggregator.aggregate()
        }
      } catch (e) {
        console.error(
          `Aggregator ${Aggregator.name} failed: ${(e as Error)?.message}`
        )
        console.error(e)
      }
    })
  )
}

function getUserRuleImplementation(
  ruleImplementationName: string,
  tenantId: string,
  user: User | Business,
  userEvent: UserEvent,
  ruleParameters: object,
  ruleAction: RuleAction,
  dynamoDb: AWS.DynamoDB.DocumentClient
) {
  const RuleClass = USER_RULES[ruleImplementationName]
  if (!RuleClass) {
    throw new Error(`${ruleImplementationName} rule implementation not found!`)
  }
  return new RuleClass(
    tenantId,
    { user, userEvent },
    { parameters: ruleParameters, action: ruleAction },
    dynamoDb
  )
}

export async function verifyUserEvent(
  userEvent: UserEvent,
  tenantId: string,
  dynamoDb: AWS.DynamoDB.DocumentClient
): Promise<UserMonitoringResult> {
  const ruleRepository = new RuleRepository(tenantId, {
    dynamoDb,
  })
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const userRepository = new UserRepository(tenantId, {
    dynamoDb,
  })
  const userEventRepository = new UserEventRepository(tenantId, { dynamoDb })

  const [user, ruleInstances] = await Promise.all([
    userRepository.getUser<User | Business>(userEvent.userId),
    ruleInstanceRepository.getActiveRuleInstances('USER'),
  ])
  const { executedRules, hitRules } = await getRulesResult(
    ruleRepository,
    ruleInstanceRepository,
    ruleInstances,
    (ruleImplementationName, ruleInstance) =>
      getUserRuleImplementation(
        ruleImplementationName,
        tenantId,
        user,
        userEvent,
        ruleInstance.parameters,
        ruleInstance.action,
        dynamoDb
      )
  )
  await userEventRepository.saveUserEvent(userEvent, {
    executedRules,
    hitRules,
  })

  return {
    userId: userEvent.userId,
    executedRules,
    hitRules,
  }
}

async function getRulesResult(
  ruleRepository: RuleRepository,
  ruleInstanceRepository: RuleInstanceRepository,
  ruleInstances: ReadonlyArray<RuleInstance>,
  getRuleImplementationCallback: (
    ruleImplementationName: string,
    ruleInstance: RuleInstance
  ) => RuleBase
) {
  const rulesById = _.keyBy(
    await ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    ),
    'id'
  )
  const hitRuleInstanceIds: string[] = []
  const ruleResults = (
    await Promise.all(
      ruleInstances.map(async (ruleInstance) => {
        const ruleInfo: Rule = rulesById[ruleInstance.ruleId]
        try {
          const rule = getRuleImplementationCallback(
            rulesById[ruleInstance.ruleId].ruleImplementationName,
            ruleInstance
          )
          const shouldCompute = await everyAsync(
            rule.getFilters(),
            async (ruleFilter) => ruleFilter()
          )
          const ruleResult = shouldCompute ? await rule.computeRule() : null
          const ruleHit = !_.isNil(ruleResult)
          if (ruleHit) {
            hitRuleInstanceIds.push(ruleInstance.id as string)
          }

          return {
            ruleId: ruleInstance.ruleId,
            ruleName: ruleInfo.name,
            ruleDescription: ruleInfo.description,
            ruleAction: ruleInstance.action,
            ruleHit,
          }
        } catch (e) {
          console.error(e)
        }
      })
    )
  ).filter(Boolean) as ExecutedRulesResult[]

  await ruleInstanceRepository.incrementRuleInstanceStatsCount(
    ruleInstances.map((ruleInstance) => ruleInstance.id as string),
    hitRuleInstanceIds
  )

  const executedRules = ruleResults
    .filter((result) => result.ruleAction)
    .sort(ruleAscendingComparator) as ExecutedRulesResult[]
  const hitRules = ruleResults
    .filter((result) => result.ruleAction && result.ruleHit)
    .map((result) => ({ ...result, ruleHit: undefined }))
    .sort(ruleAscendingComparator) as HitRulesResult[]

  return {
    executedRules,
    hitRules,
  }
}
