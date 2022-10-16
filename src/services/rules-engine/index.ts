// TODO: Refactor rules engine to be a class

/* eslint-disable @typescript-eslint/no-var-requires */
import * as _ from 'lodash'
import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { UserRepository } from '../users/repositories/user-repository'
import {
  DEFAULT_DRS_RISK_ITEM,
  RiskRepository,
} from '../risk-scoring/repositories/risk-repository'
import { Aggregators } from './aggregator'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { RuleRepository } from './repositories/rule-repository'
import { TransactionRepository } from './repositories/transaction-repository'
import { TRANSACTION_RULES } from './transaction-rules'
import { Rule as RuleBase, RuleResult } from './rule'
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
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { HitRulesResult } from '@/@types/openapi-public/HitRulesResult'
import { TransactionEventMonitoringResult } from '@/@types/openapi-public/TransactionEventMonitoringResult'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import {
  getContext,
  getContextStorage,
  hasFeature,
  updateLogMetadata,
} from '@/core/utils/context'
import { logger } from '@/core/logger'
import {
  compileTemplate,
  Vars,
} from '@/services/rules-engine/utils/format-description'
import { getErrorMessage } from '@/utils/lang'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { PartyVars } from '@/services/rules-engine/transaction-rules/rule'

export type DuplicateTransactionReturnType = TransactionMonitoringResult & {
  message: string
}

const ruleAscendingComparator = (
  rule1: HitRulesResult,
  rule2: HitRulesResult
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

function getTransactionRuleImplementation(
  ruleImplementationName: string,
  tenantId: string,
  transaction: Transaction,
  senderUser: User | Business | undefined,
  receiverUser: User | Business | undefined,
  ruleParameters: object,
  ruleAction: RuleAction,
  dynamoDb: DynamoDBDocumentClient
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
  dynamoDb: DynamoDBDocumentClient,
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
  const riskRepository = new RiskRepository(tenantId, {
    dynamoDb,
  })
  const userRepository = new UserRepository(tenantId, {
    dynamoDb,
  })

  const [senderUser, receiverUser, ruleInstances] = await Promise.all([
    transaction.originUserId
      ? userRepository.getUser<User | Business>(transaction.originUserId)
      : undefined,
    transaction.destinationUserId
      ? userRepository.getUser<User | Business>(transaction.destinationUserId)
      : undefined,
    ruleInstanceRepository.getActiveRuleInstances('TRANSACTION'),
  ])
  logger.info(`Running rules`)

  return getRulesResult(
    ruleRepository,
    ruleInstanceRepository,
    riskRepository,
    ruleInstances,
    senderUser,
    (ruleImplementationName, parameters, action) =>
      getTransactionRuleImplementation(
        ruleImplementationName,
        tenantId,
        transaction,
        senderUser,
        receiverUser,
        parameters,
        action,
        dynamoDb
      )
  )
}

export async function verifyTransaction(
  transaction: Transaction,
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
): Promise<TransactionMonitoringResult | DuplicateTransactionReturnType> {
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
        message:
          'The provided transactionId already exists. No rules were run. If you want to update the attributes of this transaction, please use transaction events instead.',
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
  const initialTransactionState = transaction.transactionState || 'CREATED'
  const savedTransaction = await transactionRepository.saveTransaction(
    {
      ...transaction,
      transactionState: initialTransactionState,
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
      transactionState: initialTransactionState,
      updatedTransactionAttributes: savedTransaction,
    },
    {
      executedRules,
      hitRules,
    }
  )

  logger.info(`Updating Aggregations`)
  await updateAggregation(tenantId, savedTransaction, dynamoDb)
  logger.info(`Updated Aggregations`)

  return {
    transactionId: savedTransaction.transactionId as string,
    executedRules,
    hitRules,
  }
}

export async function verifyTransactionEvent(
  transactionEvent: TransactionEvent,
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
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
  const updatedTransaction: TransactionWithRulesResult = _.merge(
    {
      ...transaction,
      transactionState: transactionEvent.transactionState,
    },
    transactionEvent.updatedTransactionAttributes || {}
  )
  logger.info(`Running Rules`)

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
  logger.info(`Processed`)

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
  dynamoDb: DynamoDBDocumentClient
) {
  await Promise.all(
    Aggregators.map(async (Aggregator) => {
      try {
        const aggregator = new Aggregator(tenantId, transaction, dynamoDb)
        if (aggregator.shouldAggregate()) {
          await aggregator.aggregate()
        }
      } catch (e) {
        logger.error(
          `Aggregator ${Aggregator.name} failed: ${(e as Error)?.message}`
        )
        logger.error(e)
      }
    })
  )
}

export async function verifyConsumerUserEvent(
  userEvent: ConsumerUserEvent,
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
): Promise<User> {
  const userRepository = new UserRepository(tenantId, { dynamoDb })
  const userEventRepository = new UserEventRepository(tenantId, { dynamoDb })
  const user = await userRepository.getConsumerUser(userEvent.userId)
  if (!user) {
    throw new NotFound(
      `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
    )
  }
  const updatedConsumerUser: User = _.merge(
    user,
    userEvent.updatedConsumerUserAttributes || {}
  )
  await userEventRepository.saveUserEvent(userEvent, 'CONSUMER')
  await userRepository.saveConsumerUser(updatedConsumerUser)
  return updatedConsumerUser
}

export async function verifyBusinessUserEvent(
  userEvent: BusinessUserEvent,
  tenantId: string,
  dynamoDb: DynamoDBDocumentClient
): Promise<Business> {
  const userRepository = new UserRepository(tenantId, { dynamoDb })
  const userEventRepository = new UserEventRepository(tenantId, { dynamoDb })
  const user = await userRepository.getBusinessUser(userEvent.userId)
  if (!user) {
    throw new NotFound(
      `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
    )
  }
  const updatedBusinessUser: Business = _.merge(
    user,
    userEvent.updatedBusinessUserAttributes || {}
  )
  await userEventRepository.saveUserEvent(userEvent, 'BUSINESS')
  await userRepository.saveBusinessUser(updatedBusinessUser)
  return updatedBusinessUser
}

async function getRulesResult(
  ruleRepository: RuleRepository,
  ruleInstanceRepository: RuleInstanceRepository,
  riskRepository: RiskRepository,
  ruleInstances: ReadonlyArray<RuleInstance>,
  user: User | Business | undefined,
  getRuleImplementationCallback: (
    ruleImplementationName: string,
    ruleParameters: object,
    ruleAction: RuleAction
  ) => RuleBase
) {
  const rulesById = _.keyBy(
    await ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    ),
    'id'
  )
  const hitRuleInstanceIds: string[] = []
  const userRiskLevel = await getUserRiskLevel(riskRepository, user)
  const ruleResults = (
    await Promise.all(
      ruleInstances.map(async (ruleInstance) => {
        const ruleInfo: Rule = rulesById[ruleInstance.ruleId]
        // Set up rule specific context
        const context = _.cloneDeep(getContext() || {})
        context.metricDimensions = {
          ...context.metricDimensions,
          ruleId: ruleInstance.ruleId,
          ruleInstanceId: ruleInstance.id,
          ruleImplementation: ruleInfo.ruleImplementationName,
        }
        return getContextStorage().run(context, async () => {
          try {
            updateLogMetadata('ruleId', ruleInstance.ruleId)
            updateLogMetadata('ruleInstanceId', ruleInstance.id)
            logger.info(`Running rule`)
            const { parameters, action } = getUserSpecificParameters(
              userRiskLevel,
              ruleInstance
            )
            const rule = getRuleImplementationCallback(
              rulesById[ruleInstance.ruleId].ruleImplementationName,
              parameters,
              action
            )

            const shouldCompute = await everyAsync(
              rule.getFilters(),
              async (ruleFilter) => ruleFilter()
            )
            const ruleResult = shouldCompute ? await rule.computeRule() : null
            const ruleHit = !_.isNil(ruleResult)
            logger.info(`Completed rule`)
            if (ruleHit) {
              hitRuleInstanceIds.push(ruleInstance.id as string)
            }

            let ruleHitDirections: RuleHitDirection[] = []
            if (ruleResult?.hitDirections) {
              ruleHitDirections = ruleResult?.hitDirections
            } else if (ruleResult?.vars?.['hitParty'] != null) {
              // trying to derive hit direction from vars. Not ideal solution,
              // we should move to proper returning hitDirections field
              const vars: PartyVars = ruleResult.vars.hitParty as PartyVars
              ruleHitDirections = [
                vars.type === 'origin' ? 'ORIGIN' : 'DESTINATION',
              ]
            } else {
              ruleHitDirections = ['ORIGIN', 'DESTINATION']
            }

            return {
              ruleId: ruleInstance.ruleId,
              ruleInstanceId: ruleInstance.id,
              ruleName: ruleInstance.ruleNameAlias || ruleInfo.name,
              ruleDescription: await getRuleDescription(
                rule,
                ruleInfo,
                parameters as Vars,
                ruleResult ?? null
              ),
              ruleAction: action,
              ruleHit,
              ruleHitMeta: {
                hitDirections: ruleHitDirections,
              },
            }
          } catch (e) {
            logger.error(e)
          }
        })
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
    .map((result) => ({
      ruleId: result.ruleId,
      ruleInstanceId: result.ruleInstanceId,
      ruleName: result.ruleName,
      ruleDescription: result.ruleDescription,
      ruleAction: result.ruleAction,
      ruleHitMeta: result.ruleHitMeta,
    }))
    .sort(ruleAscendingComparator) as HitRulesResult[]

  return {
    executedRules,
    hitRules,
  }
}

async function getUserRiskLevel(
  riskRepository: RiskRepository,
  user: User | Business | undefined
): Promise<RiskLevel | undefined> {
  if (!user?.userId || !hasFeature('PULSE')) {
    return undefined
  }
  const riskItem = await riskRepository.getManualDRSRiskItem(user?.userId)
  return riskItem?.riskLevel
}

function getUserSpecificParameters(
  userRiskLevel: RiskLevel | undefined,
  ruleInstance: RuleInstance
): {
  parameters: object
  action: RuleAction
} {
  if (hasFeature('PULSE') && ruleInstance.riskLevelParameters) {
    const riskLevel =
      userRiskLevel || (DEFAULT_DRS_RISK_ITEM.riskLevel as RiskLevel)
    return {
      parameters: ruleInstance.riskLevelParameters[riskLevel],
      action: ruleInstance.riskLevelActions?.[riskLevel] as RuleAction,
    }
  }
  return {
    parameters: ruleInstance.parameters,
    action: ruleInstance.action,
  }
}

async function getRuleDescription(
  rule: RuleBase,
  ruleInfo: Rule,
  parameters: Vars,
  ruleResult: RuleResult | null
): Promise<string> {
  if (ruleResult != null && ruleInfo.descriptionTemplate != null) {
    try {
      const ruleDescriptionTemplate = compileTemplate(
        ruleInfo.descriptionTemplate
      )
      // const vars = await rule.getDescriptionVars()
      return ruleDescriptionTemplate({
        ...ruleResult.vars,
        parameters,
      })
    } catch (e) {
      logger.error(
        `Unable to format contextual description, using general description as a fallback. Original template: "${
          ruleInfo.descriptionTemplate
        }". Details: ${getErrorMessage(e)}`
      )
    }
  }
  return ruleInfo.description
}
