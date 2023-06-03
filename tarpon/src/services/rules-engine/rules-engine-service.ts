import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import _ from 'lodash'
import { MongoClient } from 'mongodb'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { DEFAULT_RISK_LEVEL } from '../risk-scoring/utils'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { DynamoDbTransactionRepository } from './repositories/dynamodb-transaction-repository'
import { TransactionEventRepository } from './repositories/transaction-event-repository'
import { RuleRepository } from './repositories/rule-repository'
import { RuleInstanceRepository } from './repositories/rule-instance-repository'
import { TRANSACTION_RULES, TransactionRuleBase } from './transaction-rules'
import { generateRuleDescription, Vars } from './utils/format-description'
import { Aggregators } from './aggregator'
import { TransactionAggregationRule } from './transaction-rules/aggregation-rule'
import { RuleHitResult, RuleHitResultItem } from './rule'
import {
  TransactionFilters,
  TRANSACTION_FILTERS,
  TRANSACTION_HISTORICAL_FILTERS,
  UserFilters,
  USER_FILTERS,
} from './filters'
import { USER_RULES, UserRuleBase } from './user-rules'
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
  publishMetric,
} from '@/core/utils/context'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionEventMonitoringResult } from '@/@types/openapi-public/TransactionEventMonitoringResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { RULE_EXECUTION_TIME_MS_METRIC } from '@/core/cloudwatch/metrics'
import { addNewSubsegment } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { UserMonitoringResult } from '@/@types/openapi-public/UserMonitoringResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { mergeObjects } from '@/utils/object'

const ruleAscendingComparator = (
  rule1: HitRulesDetails,
  rule2: HitRulesDetails
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

export function getExecutedAndHitRulesResult(
  ruleResults: ExecutedRulesResult[]
): {
  executedRules: ExecutedRulesResult[]
  hitRules: HitRulesDetails[]
} {
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
      labels: result?.labels,
      nature: result?.nature,
    }))
    .sort(ruleAscendingComparator) as HitRulesDetails[]

  return {
    executedRules,
    hitRules,
  }
}

function mergeRules<T extends { ruleInstanceId: string }>(
  rulesA: Array<T>,
  rulesB: Array<T>
): Array<T> {
  return _.uniqBy((rulesA ?? []).concat(rulesB ?? []), (r) => r.ruleInstanceId)
}

export type DuplicateTransactionReturnType = TransactionMonitoringResult & {
  message: string
}

export class RulesEngineService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  transactionRepository: DynamoDbTransactionRepository
  transactionEventRepository: TransactionEventRepository
  ruleRepository: RuleRepository
  ruleInstanceRepository: RuleInstanceRepository
  riskRepository: RiskRepository
  userRepository: UserRepository
  tenantRepository: TenantRepository

  constructor(
    tenantId: string,
    dynamoDb: DynamoDBDocumentClient,
    mongoDb?: MongoClient
  ) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
    this.transactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )
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
      mongoDb,
    })
    this.tenantRepository = new TenantRepository(tenantId, {
      dynamoDb,
    })
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

    const previousTransactionEvents =
      await this.transactionEventRepository.getTransactionEvents(
        transaction.transactionId
      )

    const { executedRules, hitRules } = await this.verifyTransactionInternal(
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

    await this.updateGlobalAggregation(
      savedTransaction,
      previousTransactionEvents
    )

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
    const previousTransactionEvents =
      await this.transactionEventRepository.getTransactionEvents(
        transaction.transactionId
      )
    const updatedTransaction = mergeObjects(
      {
        ...transaction,
        transactionState: transactionEvent.transactionState,
      },
      transactionEvent.updatedTransactionAttributes || {}
    ) as TransactionWithRulesResult

    const { executedRules, hitRules } = await this.verifyTransactionInternal(
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
    // Update transaction with the latest payload.
    await this.transactionRepository.saveTransaction(updatedTransaction, {
      executedRules: mergeRules(
        updatedTransaction.executedRules,
        executedRules
      ),
      hitRules: mergeRules(updatedTransaction.hitRules, hitRules),
    })
    saveTransactionSegment?.close()

    // For duplicated transaction events with the same state, we don't re-aggregated
    // but this won't prevent re-aggregation if we have the states like [CREATED, APPROVED, CREATED]
    if (transaction.transactionState !== updatedTransaction.transactionState) {
      await this.updateGlobalAggregation(
        updatedTransaction,
        previousTransactionEvents
      )
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

  public async verifyTransactionForSimulation(
    transaction: Transaction,
    ruleInstance: RuleInstance
  ): Promise<ExecutedRulesResult> {
    const { senderUser, receiverUser } = await this.getTransactionUsers(
      transaction
    )
    const rule = await this.ruleRepository.getRuleById(ruleInstance.ruleId)
    if (!rule) {
      throw new Error(`Cannot find rule ${ruleInstance.ruleId}`)
    }

    const senderUserRiskLevel = await this.getUserRiskLevel(senderUser)
    const { result } = await this.verifyRuleIdempotent({
      rule,
      ruleInstance,
      senderUserRiskLevel,
      transaction,
      senderUser,
      receiverUser,
      database: 'MONGODB',
    })
    return result
  }

  public async verifyUser(
    user: UserWithRulesResult | BusinessWithRulesResult
  ): Promise<UserMonitoringResult> {
    const ruleInstances =
      await this.ruleInstanceRepository.getActiveRuleInstances('USER')

    const rules = await this.ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    )
    return this.verifyUserByRules(user, ruleInstances, rules)
  }

  public async verifyUserByRules(
    user: UserWithRulesResult | BusinessWithRulesResult,
    ruleInstances: readonly RuleInstance[],
    rules: readonly Rule[]
  ): Promise<UserMonitoringResult> {
    const rulesById = _.keyBy(rules, 'id')
    logger.info(`Running rules`)
    const userRiskLevel = await this.getUserRiskLevel(user)
    const ruleResults = (
      await Promise.all(
        ruleInstances.map(async (ruleInstance) =>
          this.verifyUserRule({
            rule: rulesById[ruleInstance.ruleId],
            ruleInstance,
            user,
            userRiskLevel,
          })
        )
      )
    ).filter(Boolean) as ExecutedRulesResult[]

    // Update rule execution stats
    const hitRuleInstanceIds = ruleResults
      .filter((ruleResult) => ruleResult.ruleHit)
      .map((ruleResults) => ruleResults.ruleInstanceId)

    await this.ruleInstanceRepository.incrementRuleInstanceStatsCount(
      ruleInstances.map((ruleInstance) => ruleInstance.id as string),
      hitRuleInstanceIds
    )
    const executionResult = getExecutedAndHitRulesResult(ruleResults)

    return {
      userId: user.userId,
      ...executionResult,
    }
  }

  private async verifyTransactionInternal(transaction: Transaction): Promise<{
    executedRules: ExecutedRulesResult[]
    hitRules: HitRulesDetails[]
  }> {
    const getInitialDataSegment = await addNewSubsegment(
      'Rules Engine',
      'Get Initial Data'
    )
    const { senderUser, receiverUser } = await this.getTransactionUsers(
      transaction
    )
    const ruleInstances =
      await this.ruleInstanceRepository.getActiveRuleInstances('TRANSACTION')

    const rulesById = _.keyBy(
      await this.ruleRepository.getRulesByIds(
        ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
      ),
      'id'
    )
    const senderUserRiskLevel = await this.getUserRiskLevel(senderUser)
    getInitialDataSegment?.close()

    const runRulesSegment = await addNewSubsegment('Rules Engine', 'Run Rules')
    logger.info(`Running rules`)
    const ruleResults = (
      await Promise.all(
        ruleInstances.map(async (ruleInstance) =>
          this.verifyTransactionRule({
            rule: rulesById[ruleInstance.ruleId],
            ruleInstance,
            senderUserRiskLevel,
            transaction,
            senderUser,
            receiverUser,
          })
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
    return getExecutedAndHitRulesResult(ruleResults)
  }

  private async verifyRuleIdempotent(options: {
    rule: Rule
    ruleInstance: RuleInstance
    senderUserRiskLevel: RiskLevel | undefined
    transaction?: Transaction
    database: 'MONGODB' | 'DYNAMODB'
    senderUser?: User | Business
    receiverUser?: User | Business
    tracing?: boolean
  }) {
    const {
      rule,
      ruleInstance,
      senderUserRiskLevel,
      transaction,
      senderUser,
      receiverUser,
      database,
      tracing,
    } = options
    const { parameters, action } = this.getUserSpecificParameters(
      senderUserRiskLevel,
      ruleInstance
    )
    const ruleImplementationName = rule.ruleImplementationName
    const RuleClass = transaction
      ? TRANSACTION_RULES[ruleImplementationName]
      : USER_RULES[ruleImplementationName]
    if (!RuleClass) {
      throw new Error(
        `${ruleImplementationName} rule implementation not found!`
      )
    }
    const ruleFilters = ruleInstance.filters as TransactionFilters & UserFilters
    const mode =
      database === 'MONGODB' || process.env.__INTERNAL_MONGODB_MIRROR__
        ? 'MONGODB'
        : 'DYNAMODB'

    const ruleClassInstance = transaction
      ? new (RuleClass as typeof TransactionRuleBase)(
          this.tenantId,
          {
            transaction,
            senderUser,
            receiverUser,
          },
          { parameters, filters: ruleFilters },
          { ruleInstance },
          mode,
          this.dynamoDb,
          mode === 'MONGODB' ? await getMongoDbClient() : undefined
        )
      : new (RuleClass as typeof UserRuleBase)(
          this.tenantId,
          {
            user: senderUser!,
          },
          { parameters, filters: ruleFilters },
          await getMongoDbClient()
        )

    const segmentNamespace = `Rules Engine - ${ruleInstance.ruleId} (${ruleInstance.id})`
    let filterSegment = undefined
    if (!_.isEmpty(ruleFilters) && tracing) {
      filterSegment = await addNewSubsegment(segmentNamespace, 'Rule Filtering')
    }
    const {
      isTransactionFiltered,
      isTransactionHistoricalFiltered,
      isOriginUserFiltered,
      isDestinationUserFiltered,
    } = await this.computeRuleFilters(ruleFilters, {
      transaction,
      senderUser,
      receiverUser,
    })
    const shouldRunRule =
      isTransactionFiltered &&
      (isOriginUserFiltered || isDestinationUserFiltered)
    if (!_.isEmpty(ruleFilters)) {
      filterSegment?.close()
    }

    let runSegment = undefined
    if (shouldRunRule && tracing) {
      runSegment = await addNewSubsegment(segmentNamespace, 'Rule Execution')
    }
    const ruleResult = shouldRunRule
      ? await ruleClassInstance.computeRule()
      : null
    const filteredRuleResult = ruleResult
      ? this.getFilteredRuleResult(
          ruleResult,
          ruleFilters,
          isOriginUserFiltered,
          isDestinationUserFiltered
        )
      : []
    runSegment?.close()

    const ruleHit =
      (filteredRuleResult && filteredRuleResult.length > 0) ?? false
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
    let ruleDescription = ruleInstance.ruleDescriptionAlias

    if (!ruleDescription) {
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
      ruleDescription = Array.from(new Set(ruleDescriptions)).join(' ')
    }
    const sanctionsDetails = filteredRuleResult.flatMap(
      (r) => r.sanctionsDetails || []
    )

    return {
      ruleClassInstance,
      isTransactionHistoricalFiltered,
      result: {
        ruleId: ruleInstance.ruleId,
        ruleInstanceId: ruleInstance.id!,
        ruleName: ruleInstance.ruleNameAlias || rule.name,
        ruleDescription,
        ruleAction: action,
        ruleHit,
        labels: ruleInstance.labels,
        nature: ruleInstance.nature,
        ruleHitMeta: ruleHit
          ? {
              hitDirections: ruleHitDirections,
              falsePositiveDetails: falsePositiveDetails?.length
                ? falsePositiveDetails[0]
                : undefined,
              sanctionsDetails: sanctionsDetails.length
                ? sanctionsDetails
                : undefined,
            }
          : undefined,
      },
    }
  }

  private async verifyTransactionRule(options: {
    rule: Rule
    ruleInstance: RuleInstance
    senderUserRiskLevel: RiskLevel | undefined
    transaction: Transaction
    senderUser?: User | Business
    receiverUser?: User | Business
  }) {
    const { rule, ruleInstance } = options
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
        const { ruleClassInstance, isTransactionHistoricalFiltered, result } =
          await this.verifyRuleIdempotent({
            ...options,
            tracing: true,
            database: 'DYNAMODB',
          })
        const ruleExecutionTimeMs = Date.now().valueOf() - startTime.valueOf()
        // Don't await publishing metric
        publishMetric(RULE_EXECUTION_TIME_MS_METRIC, ruleExecutionTimeMs)
        logger.info(`Completed rule`)

        if (ruleClassInstance instanceof TransactionAggregationRule) {
          await Promise.all([
            ruleClassInstance.updateAggregation(
              'origin',
              isTransactionHistoricalFiltered
            ),
            ruleClassInstance.updateAggregation(
              'destination',
              isTransactionHistoricalFiltered
            ),
          ])
        }
        return result
      } catch (e) {
        logger.error(e)
      }
    })
  }

  private async verifyUserRule(options: {
    rule: Rule
    ruleInstance: RuleInstance
    userRiskLevel: RiskLevel | undefined
    user: User | Business
  }) {
    const context = _.cloneDeep(getContext() || {})
    return getContextStorage().run(context, async () => {
      try {
        updateLogMetadata({
          ruleId: options.ruleInstance.ruleId,
          ruleInstanceId: options.ruleInstance.id,
          userId: options.user.userId,
        })
        logger.info(`Running rule`)
        const startTime = Date.now()
        const { result } = await this.verifyRuleIdempotent({
          rule: options.rule,
          ruleInstance: options.ruleInstance,
          senderUser: options.user,
          senderUserRiskLevel: options.userRiskLevel,
          database: 'MONGODB',
        })
        const ruleExecutionTimeMs = Date.now().valueOf() - startTime.valueOf()
        // Don't await publishing metric
        publishMetric(RULE_EXECUTION_TIME_MS_METRIC, ruleExecutionTimeMs)
        logger.info(`Completed rule`)
        return result
      } catch (e) {
        logger.error(e)
      }
    })
  }

  private async computeRuleFilters(
    ruleFilters: { [key: string]: any },
    data: {
      transaction?: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    }
  ): Promise<{
    isTransactionFiltered: boolean
    isTransactionHistoricalFiltered: boolean
    isOriginUserFiltered: boolean
    isDestinationUserFiltered: boolean
  }> {
    let isTransactionFiltered = true
    let isTransactionHistoricalFiltered = true
    let isOriginUserFiltered = true
    let isDestinationUserFiltered = true

    for (const filterKey in ruleFilters) {
      const UserRuleFilterClass = USER_FILTERS[filterKey]
      if (UserRuleFilterClass && ruleFilters[filterKey]) {
        const [originUserFiltered, destinationUserFiltered] = await Promise.all(
          [data.senderUser, data.receiverUser].map(async (user) => {
            if (!user) {
              return false
            }
            const ruleFilter = new UserRuleFilterClass(
              this.tenantId,
              { user: user! },
              { [filterKey]: ruleFilters[filterKey] },
              this.dynamoDb
            )
            return ruleFilter.predicate()
          })
        )

        if (!originUserFiltered) {
          isOriginUserFiltered = originUserFiltered
        }
        if (!destinationUserFiltered) {
          isDestinationUserFiltered = destinationUserFiltered
        }
        if (!isOriginUserFiltered && !isDestinationUserFiltered) {
          break
        }
      }
    }
    if (data.transaction) {
      for (const filterKey in ruleFilters) {
        const TransactionRuleFilterClass = TRANSACTION_FILTERS[filterKey]
        if (TransactionRuleFilterClass && ruleFilters[filterKey]) {
          const ruleFilter = new TransactionRuleFilterClass(
            this.tenantId,
            { transaction: data.transaction },
            { [filterKey]: ruleFilters[filterKey] },
            this.dynamoDb
          )
          isTransactionFiltered = await ruleFilter.predicate()
          if (!isTransactionFiltered) {
            break
          }
        }
      }
      for (const filterKey in ruleFilters) {
        const TransactionRuleFilterClass =
          TRANSACTION_HISTORICAL_FILTERS[filterKey]
        if (TransactionRuleFilterClass && ruleFilters[filterKey]) {
          const ruleFilter = new TransactionRuleFilterClass(
            this.tenantId,
            { transaction: data.transaction },
            { [filterKey]: ruleFilters[filterKey] },
            this.dynamoDb
          )
          isTransactionHistoricalFiltered = await ruleFilter.predicate()
          if (!isTransactionHistoricalFiltered) {
            break
          }
        }
      }
    }
    return {
      isTransactionFiltered,
      isTransactionHistoricalFiltered,
      isOriginUserFiltered,
      isDestinationUserFiltered,
    }
  }

  private getFilteredRuleResult(
    ruleResult: RuleHitResult,
    ruleFilters: TransactionFilters & UserFilters = {},
    isOriginUserFiltered: boolean,
    isDestinationUserFiltered: boolean
  ): RuleHitResultItem[] {
    let filteredResult = ruleResult.filter(Boolean) as RuleHitResultItem[]
    if (ruleFilters.checkDirection) {
      filteredResult = filteredResult.filter(
        (hitResult) => hitResult.direction === ruleFilters.checkDirection
      )
    }
    if (!isOriginUserFiltered) {
      filteredResult = filteredResult.filter(
        (hitResult) => hitResult.direction !== 'ORIGIN'
      )
    }
    if (!isDestinationUserFiltered) {
      filteredResult = filteredResult.filter(
        (hitResult) => hitResult.direction !== 'DESTINATION'
      )
    }
    return filteredResult
  }

  private async getUserRiskLevel(
    user: UserWithRulesResult | BusinessWithRulesResult | undefined
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
      action: ruleInstance.action as RuleAction,
    }
  }

  private async getTransactionUsers(transaction: Transaction): Promise<{
    senderUser: User | Business | undefined
    receiverUser: User | Business | undefined
  }> {
    const [senderUser, receiverUser] = await Promise.all([
      transaction.originUserId
        ? this.userRepository.getUser<User | Business>(transaction.originUserId)
        : undefined,
      transaction.destinationUserId
        ? this.userRepository.getUser<User | Business>(
            transaction.destinationUserId
          )
        : undefined,
    ])
    return {
      senderUser,
      receiverUser,
    }
  }

  private async updateGlobalAggregation(
    transaction: Transaction,
    previousTransactionEvents: TransactionEvent[]
  ) {
    const updateAggregationsSegment = await addNewSubsegment(
      'Rules Engine',
      'Update Global Aggregations'
    )
    logger.info(`Updating global aggregations`)

    await Promise.all(
      Aggregators.map(async (Aggregator) => {
        try {
          const aggregator = new Aggregator(
            this.tenantId,
            transaction,
            this.dynamoDb
          )

          if (
            aggregator.getTargetTransactionState() ===
              transaction.transactionState &&
            !previousTransactionEvents
              .map((event) => event.transactionState)
              .includes(aggregator.getTargetTransactionState())
          ) {
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
    logger.info(`Updated global aggregations`)
    updateAggregationsSegment?.close()
  }
}
