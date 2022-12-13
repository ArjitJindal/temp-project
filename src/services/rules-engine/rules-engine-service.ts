import * as Sentry from '@sentry/serverless'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import _ from 'lodash'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { DEFAULT_RISK_LEVEL } from '../risk-scoring/utils'
import { TransactionRepository } from './repositories/transaction-repository'
import { TransactionEventRepository } from './repositories/transaction-event-repository'
import { RuleRepository } from './repositories/rule-repository'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { TRANSACTION_RULES } from './transaction-rules'
import { generateRuleDescription, Vars } from './utils/format-description'
import { Aggregators } from './aggregator'
import { UserEventRepository } from './repositories/user-event-repository'
import { TransactionAggregationRule } from './transaction-rules/aggregation-rule'
import { RuleHitResult } from './rule'
import {
  TransactionFilters,
  TRANSACTION_FILTERS,
  UserFilters,
  USER_FILTERS,
} from './filters'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { logger } from '@/core/logger'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'
import {
  getContext,
  getContextStorage,
  hasFeature,
  updateLogMetadata,
} from '@/core/utils/context'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionEventMonitoringResult } from '@/@types/openapi-public/TransactionEventMonitoringResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { MetricPublisher } from '@/core/cloudwatch/metric-publisher'
import { RULE_EXECUTION_TIME_MS_METRIC } from '@/core/cloudwatch/metrics'
import { addNewSubsegment } from '@/core/xray'

const ruleAscendingComparator = (
  rule1: HitRulesDetails,
  rule2: HitRulesDetails
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

export type DuplicateTransactionReturnType = TransactionMonitoringResult & {
  message: string
}

export class RulesEngineService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  transactionRepository: TransactionRepository
  transactionEventRepository: TransactionEventRepository
  ruleRepository: RuleRepository
  ruleInstanceRepository: RuleInstanceRepository
  riskRepository: RiskRepository
  userRepository: UserRepository
  userEventRepository: UserEventRepository

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
    this.transactionRepository = new TransactionRepository(tenantId, {
      dynamoDb,
    })
    this.transactionEventRepository = new TransactionEventRepository(tenantId, {
      dynamoDb,
    })
    this.ruleRepository = new RuleRepository(tenantId, {
      dynamoDb,
    })
    this.ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    this.riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
    })
    this.userRepository = new UserRepository(tenantId, {
      dynamoDb,
    })
    this.userEventRepository = new UserEventRepository(tenantId, { dynamoDb })
  }

  public async verifyTransaction(
    transaction: Transaction
  ): Promise<TransactionMonitoringResult | DuplicateTransactionReturnType> {
    if (transaction.transactionId) {
      const existingTransaction =
        await this.transactionRepository.getTransactionById(
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

    const { executedRules, hitRules } = await this.verifyTransactionIdempotent(
      transaction
    )
    const saveTransactionSegment = await addNewSubsegment(
      'Rules Engine',
      'Save Transaction/Event'
    )
    const initialTransactionState = transaction.transactionState || 'CREATED'
    const savedTransaction = await this.transactionRepository.saveTransaction(
      {
        ...transaction,
        transactionState: initialTransactionState,
      },
      {
        executedRules,
        hitRules,
      }
    )

    await this.transactionEventRepository.saveTransactionEvent(
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
    saveTransactionSegment?.close()

    await this.updateAggregation(savedTransaction)

    return {
      transactionId: savedTransaction.transactionId as string,
      executedRules,
      hitRules,
    }
  }

  public async verifyTransactionEvent(
    transactionEvent: TransactionEvent
  ): Promise<TransactionEventMonitoringResult> {
    const transaction = await this.transactionRepository.getTransactionById(
      transactionEvent.transactionId
    )
    if (!transaction) {
      throw new NotFound(
        `Transaction ${transactionEvent.transactionId} not found`
      )
    }
    const updatedTransaction: TransactionWithRulesResult = _.merge(
      {
        ...transaction,
        transactionState: transactionEvent.transactionState,
      },
      transactionEvent.updatedTransactionAttributes || {}
    )

    const { executedRules, hitRules } = await this.verifyTransactionIdempotent(
      updatedTransaction
    )

    const saveTransactionSegment = await addNewSubsegment(
      'Rules Engine',
      'Save Transaction/Event'
    )
    const eventId = await this.transactionEventRepository.saveTransactionEvent(
      transactionEvent,
      {
        executedRules,
        hitRules,
      }
    )
    // Update transaction with the latest payload
    await this.transactionRepository.saveTransaction(updatedTransaction, {
      executedRules,
      hitRules,
    })
    saveTransactionSegment?.close()

    // For duplicated transaction events with the same state, we don't re-aggregated
    // but this won't prevent re-aggregation if we have the states like [CREATED, APPROVED, CREATED]
    if (transaction.transactionState !== updatedTransaction.transactionState) {
      await this.updateAggregation(updatedTransaction)
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

  public async verifyConsumerUserEvent(
    userEvent: ConsumerUserEvent
  ): Promise<User> {
    const user = await this.userRepository.getConsumerUser(userEvent.userId)
    if (!user) {
      throw new NotFound(
        `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
      )
    }
    const updatedConsumerUser: User = _.merge(
      user,
      userEvent.updatedConsumerUserAttributes || {}
    )
    await this.userEventRepository.saveUserEvent(userEvent, 'CONSUMER')
    await this.userRepository.saveConsumerUser(updatedConsumerUser)
    return updatedConsumerUser
  }

  public async verifyBusinessUserEvent(
    userEvent: BusinessUserEvent
  ): Promise<Business> {
    const user = await this.userRepository.getBusinessUser(userEvent.userId)
    if (!user) {
      throw new NotFound(
        `User ${userEvent.userId} not found. Please create the user ${userEvent.userId}`
      )
    }
    const updatedBusinessUser: Business = _.merge(
      user,
      userEvent.updatedBusinessUserAttributes || {}
    )
    await this.userEventRepository.saveUserEvent(userEvent, 'BUSINESS')
    await this.userRepository.saveBusinessUser(updatedBusinessUser)
    return updatedBusinessUser
  }

  private async verifyTransactionIdempotent(transaction: Transaction): Promise<{
    executedRules: ExecutedRulesResult[]
    hitRules: HitRulesDetails[]
  }> {
    const getInitialDataSegment = await addNewSubsegment(
      'Rules Engine',
      'Get Initial Data'
    )
    const [senderUser, receiverUser, ruleInstances] = await Promise.all([
      transaction.originUserId
        ? this.userRepository.getUser<User | Business>(transaction.originUserId)
        : undefined,
      transaction.destinationUserId
        ? this.userRepository.getUser<User | Business>(
            transaction.destinationUserId
          )
        : undefined,
      this.ruleInstanceRepository.getActiveRuleInstances('TRANSACTION'),
    ])
    const rulesById = _.keyBy(
      await this.ruleRepository.getRulesByIds(
        ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
      ),
      'id'
    )
    const userRiskLevel = await this.getUserRiskLevel(senderUser)
    getInitialDataSegment?.close()

    const runRulesSegment = await addNewSubsegment('Rules Engine', 'Run Rules')
    logger.info(`Running rules`)
    const ruleResults = (
      await Promise.all(
        ruleInstances.map(async (ruleInstance) =>
          this.runRule(
            rulesById[ruleInstance.ruleId],
            ruleInstance,
            userRiskLevel,
            { transaction, senderUser, receiverUser }
          )
        )
      )
    ).filter(Boolean) as ExecutedRulesResult[]
    runRulesSegment?.close()

    const updateStatsSegment = await addNewSubsegment(
      'Rules Engine',
      'Update Rules Stats'
    )
    // Update rule execution stats
    const hitRuleInstanceIds = ruleResults
      .filter((ruleResult) => ruleResult.ruleHit)
      .map((ruleResults) => ruleResults.ruleInstanceId)
    await this.ruleInstanceRepository.incrementRuleInstanceStatsCount(
      ruleInstances.map((ruleInstance) => ruleInstance.id as string),
      hitRuleInstanceIds
    )
    updateStatsSegment?.close()

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
      .sort(ruleAscendingComparator) as HitRulesDetails[]

    return {
      executedRules,
      hitRules,
    }
  }

  private async runRule(
    rule: Rule,
    ruleInstance: RuleInstance,
    userRiskLevel: RiskLevel | undefined,
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    }
  ) {
    const metricPublisher = new MetricPublisher()
    const context = _.cloneDeep(getContext() || {})
    context.metricDimensions = {
      ...context.metricDimensions,
      ruleId: ruleInstance.ruleId,
      ruleInstanceId: ruleInstance.id,
      ruleImplementation: rule.ruleImplementationName,
    }
    return getContextStorage().run(context, async () => {
      try {
        updateLogMetadata({
          ruleId: ruleInstance.ruleId,
          ruleInstanceId: ruleInstance.id,
        })
        logger.info(`Running rule`)
        const startTime = Date.now()

        const { parameters, action } = this.getUserSpecificParameters(
          userRiskLevel,
          ruleInstance
        )
        const ruleImplementationName = rule.ruleImplementationName
        const RuleClass = TRANSACTION_RULES[ruleImplementationName]
        if (!RuleClass) {
          throw new Error(
            `${ruleImplementationName} rule implementation not found!`
          )
        }
        const ruleFilters = ruleInstance.filters as TransactionFilters &
          UserFilters

        const ruleClassInstance = new RuleClass(
          this.tenantId,
          {
            transaction: data.transaction,
            senderUser: data.senderUser,
            receiverUser: data.receiverUser,
          },
          { parameters, filters: ruleFilters },
          { ruleInstance },
          this.dynamoDb
        )

        const segmentNamespace = `Rules Engine - ${ruleInstance.ruleId} (${ruleInstance.id})`
        let filterSegment = undefined
        if (!_.isEmpty(ruleFilters)) {
          filterSegment = await addNewSubsegment(
            segmentNamespace,
            'Rule Filtering'
          )
        }
        const shouldCompute = await this.computeRuleFilters(ruleFilters, data)
        if (!_.isEmpty(ruleFilters)) {
          filterSegment?.close()
        }

        let runSegment = undefined
        if (shouldCompute) {
          runSegment = await addNewSubsegment(
            segmentNamespace,
            'Rule Execution'
          )
        }
        const ruleResult = shouldCompute
          ? await ruleClassInstance.computeRule()
          : null
        const filteredRuleResult =
          ruleResult && this.getFilteredRuleResult(ruleResult, ruleFilters)

        if (shouldCompute) {
          if (ruleClassInstance instanceof TransactionAggregationRule) {
            await Promise.all([
              ruleClassInstance.updateAggregation('origin'),
              ruleClassInstance.updateAggregation('destination'),
            ])
          }
          runSegment?.close()
        }

        const ruleHit =
          (filteredRuleResult && filteredRuleResult.length > 0) ?? false

        const ruleExecutionTimeMs = Date.now().valueOf() - startTime.valueOf()
        // Don't await publishing metric
        metricPublisher.publicMetric(
          RULE_EXECUTION_TIME_MS_METRIC,
          ruleExecutionTimeMs
        )

        logger.info(`Completed rule`)

        const ruleHitDirections: RuleHitDirection[] =
          filteredRuleResult?.map((result) => result.direction) || []

        const falsePositiveDetails = filteredRuleResult?.map((result) => {
          if (
            result.falsePositiveDetails &&
            result.falsePositiveDetails.isFalsePositive
          ) {
            return result.falsePositiveDetails
          }
        })
        const ruleDescriptions = (
          ruleHit
            ? await Promise.all(
                filteredRuleResult!.map((result) =>
                  generateRuleDescription(rule, parameters as Vars, result.vars)
                )
              )
            : [rule.description]
        ).map((description) =>
          _.last(description) !== '.' ? `${description}.` : description
        )
        const ruleDescription = Array.from(new Set(ruleDescriptions)).join(' ')

        return {
          ruleId: ruleInstance.ruleId,
          ruleInstanceId: ruleInstance.id,
          ruleName: ruleInstance.ruleNameAlias || rule.name,
          ruleDescription,
          ruleAction: action,
          ruleHit,
          ruleHitMeta: ruleHit
            ? {
                hitDirections: ruleHitDirections,
                caseCreationType: ruleInstance.caseCreationType,
                falsePositiveDetails: falsePositiveDetails?.length
                  ? falsePositiveDetails[0]
                  : {},
              }
            : undefined,
        }
      } catch (e) {
        logger.error(e)
        Sentry.captureException(e)
      }
    })
  }

  private async computeRuleFilters(
    ruleFilters: { [key: string]: any },
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    }
  ) {
    for (const filterKey in ruleFilters) {
      const UserRuleFilterClass = USER_FILTERS[filterKey]
      if (UserRuleFilterClass && ruleFilters[filterKey]) {
        const results = await Promise.all(
          [data.senderUser, data.receiverUser]
            .filter(Boolean)
            .map(async (user) => {
              const ruleFilter = new UserRuleFilterClass(
                this.tenantId,
                { user: user! },
                { [filterKey]: ruleFilters[filterKey] },
                this.dynamoDb
              )
              return ruleFilter.predicate()
            })
        )
        if (results.includes(false)) {
          return false
        }
      }
      const TransactionRuleFilterClass = TRANSACTION_FILTERS[filterKey]
      if (TransactionRuleFilterClass && ruleFilters[filterKey]) {
        const ruleFilter = new TransactionRuleFilterClass(
          this.tenantId,
          { transaction: data.transaction },
          { [filterKey]: ruleFilters[filterKey] },
          this.dynamoDb
        )
        if (!(await ruleFilter.predicate())) {
          return false
        }
      }
    }
    return true
  }

  private getFilteredRuleResult(
    ruleResult: RuleHitResult,
    ruleFilters: TransactionFilters & UserFilters = {}
  ): RuleHitResult {
    if (ruleFilters.checkDirection) {
      return ruleResult.filter(
        (hitResult) => hitResult.direction === ruleFilters.checkDirection
      )
    }
    return ruleResult
  }

  private async getUserRiskLevel(
    user: User | Business | undefined
  ): Promise<RiskLevel | undefined> {
    if (!user?.userId || !hasFeature('PULSE')) {
      return undefined
    }
    const riskItem = await this.riskRepository.getDRSRiskItem(user?.userId)
    return riskItem?.manualRiskLevel ?? riskItem?.derivedRiskLevel
  }

  private getUserSpecificParameters(
    userRiskLevel: RiskLevel | undefined,
    ruleInstance: RuleInstance
  ): {
    parameters: object
    action: RuleAction
  } {
    if (hasFeature('PULSE') && ruleInstance.riskLevelParameters) {
      const riskLevel = userRiskLevel || DEFAULT_RISK_LEVEL
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

  private async updateAggregation(transaction: Transaction) {
    const updateAggregationsSegment = await addNewSubsegment(
      'Rules Engine',
      'Update Aggregations'
    )
    logger.info(`Updating Aggregations`)
    await Promise.all(
      Aggregators.map(async (Aggregator) => {
        try {
          const aggregator = new Aggregator(
            this.tenantId,
            transaction,
            this.dynamoDb
          )
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
    logger.info(`Updated Aggregations`)
    updateAggregationsSegment?.close()
  }
}
