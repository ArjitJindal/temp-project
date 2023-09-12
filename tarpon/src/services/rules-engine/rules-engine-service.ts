import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import {
  compact,
  map,
  keyBy,
  uniqBy,
  isEmpty,
  last,
  cloneDeep,
  isNil,
  isObject,
} from 'lodash'
import { MongoClient } from 'mongodb'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { DEFAULT_RISK_LEVEL } from '../risk-scoring/utils'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { ThinWebhookDeliveryTask, sendWebhookTasks } from '../webhook/utils'
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
  TransactionRuleFilterBase,
  TRANSACTION_FILTERS,
  TRANSACTION_HISTORICAL_FILTERS,
  UserFilters,
  UserRuleFilterBase,
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
import { addNewSubsegment, traceable } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserMonitoringResult } from '@/@types/openapi-public/UserMonitoringResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { generateChecksum, mergeEntities } from '@/utils/object'
import { background } from '@/utils/background'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { TransactionStatusDetails } from '@/@types/openapi-public/TransactionStatusDetails'
import { TransactionAction } from '@/@types/openapi-internal/TransactionAction'
import { envIs } from '@/utils/env'
import { handleTransactionAggregationTask } from '@/lambdas/transaction-aggregation/app'

const sqs = new SQSClient({})

const ruleAscendingComparator = (
  rule1: HitRulesDetails,
  rule2: HitRulesDetails
) => (rule1.ruleId > rule2.ruleId ? 1 : -1)

export type TransactionAggregationTask = {
  transactionId: string
  ruleInstanceId: string
  direction: 'origin' | 'destination'
  tenantId: string
  isTransactionHistoricalFiltered: boolean
}
export type TransactionAggregationTaskEntry = {
  userKeyId: string
  payload: TransactionAggregationTask
}

export function getExecutedAndHitRulesResult(
  ruleResults: ExecutedRulesResult[]
): {
  executedRules: ExecutedRulesResult[]
  hitRules: HitRulesDetails[]
  status: RuleAction
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
    status: getAggregatedRuleStatus(hitRules.map((hr) => hr.ruleAction)),
  }
}

function mergeRules<T extends { ruleInstanceId: string }>(
  rulesA: Array<T>,
  rulesB: Array<T>
): Array<T> {
  return uniqBy((rulesA ?? []).concat(rulesB ?? []), (r) => r.ruleInstanceId)
}

export type DuplicateTransactionReturnType = TransactionMonitoringResult & {
  message: string
}

@traceable
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

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ): Promise<RulesEngineService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    return new RulesEngineService(tenantId, dynamoDb)
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
          status: existingTransaction.status,
        }
      }
    }

    const previousTransactionEvents =
      await this.transactionEventRepository.getTransactionEvents(
        transaction.transactionId
      )

    const { executedRules, hitRules, transactionAggregationTasks } =
      await this.verifyTransactionInternal(transaction)
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
        status: getAggregatedRuleStatus(hitRules.map((hr) => hr.ruleAction)),
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

    await background(
      ...transactionAggregationTasks.map((task) =>
        this.sendTransactionAggregationTasks(task)
      )
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
      status: getAggregatedRuleStatus(hitRules.map((hr) => hr.ruleAction)),
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
    const updatedTransaction = mergeEntities(
      {
        ...transaction,
        transactionState: transactionEvent.transactionState,
      },
      transactionEvent.updatedTransactionAttributes || {}
    ) as TransactionWithRulesResult

    const { executedRules, hitRules, transactionAggregationTasks } =
      await this.verifyTransactionInternal(updatedTransaction)

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
    const mergedHitRules = mergeRules(updatedTransaction.hitRules, hitRules)
    await this.transactionRepository.saveTransaction(updatedTransaction, {
      executedRules: mergeRules(
        updatedTransaction.executedRules,
        executedRules
      ),
      hitRules: mergedHitRules,
      status: getAggregatedRuleStatus(
        mergedHitRules.map((hr) => hr.ruleAction)
      ),
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

    await background(
      ...transactionAggregationTasks.map((sqsMessage) =>
        this.sendTransactionAggregationTasks(sqsMessage)
      )
    )

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
    user: UserWithRulesResult | BusinessWithRulesResult,
    options?: { ongoingScreeningMode?: boolean }
  ): Promise<UserMonitoringResult> {
    const ruleInstances =
      await this.ruleInstanceRepository.getActiveRuleInstances('USER')

    const rules = await this.ruleRepository.getRulesByIds(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    )
    return this.verifyUserByRules(user, ruleInstances, rules, options)
  }

  public async verifyUserByRules(
    user: UserWithRulesResult | BusinessWithRulesResult,
    ruleInstances: readonly RuleInstance[],
    rules: readonly Rule[],
    options?: { ongoingScreeningMode?: boolean }
  ): Promise<UserMonitoringResult> {
    const rulesById = keyBy(rules, 'id')
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
            ongoingScreeningMode: options?.ongoingScreeningMode,
          })
        )
      )
    ).filter(Boolean) as ExecutedRulesResult[]

    // Update rule execution stats
    const hitRuleInstanceIds = ruleResults
      .filter((ruleResult) => ruleResult.ruleHit)
      .map((ruleResults) => ruleResults.ruleInstanceId)

    await background(
      this.ruleInstanceRepository.incrementRuleInstanceStatsCount(
        ruleInstances.map((ruleInstance) => ruleInstance.id as string),
        hitRuleInstanceIds
      )
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
    transactionAggregationTasks: TransactionAggregationTaskEntry[]
  }> {
    const getInitialDataSegment = await addNewSubsegment(
      'Rules Engine',
      'Get Initial Data'
    )

    const { senderUser, receiverUser } = await this.getTransactionUsers(
      transaction
    )
    const senderUserRiskLevelPromise = this.getUserRiskLevel(senderUser)

    const ruleInstances =
      await this.ruleInstanceRepository.getActiveRuleInstances('TRANSACTION')

    const rulesById = keyBy(
      await this.ruleRepository.getRulesByIds(
        ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
      ),
      'id'
    )
    getInitialDataSegment?.close()

    const runRulesSegment = await addNewSubsegment('Rules Engine', 'Run Rules')
    logger.info(`Running rules`)

    const verifyTransactionResults = compact(
      await Promise.all(
        ruleInstances.map(async (ruleInstance) =>
          this.verifyTransactionRule({
            rule: rulesById[ruleInstance.ruleId],
            ruleInstance,
            senderUserRiskLevel: await senderUserRiskLevelPromise,
            transaction,
            senderUser,
            receiverUser,
          })
        )
      )
    )

    const ruleResults = compact(
      map(verifyTransactionResults, (result) => result.result)
    ) as ExecutedRulesResult[]

    runRulesSegment?.close()

    const updateStatsSegment = await addNewSubsegment(
      'Rules Engine',
      'Update Rules Stats'
    )

    // Update rule execution stats
    const hitRuleInstanceIds = ruleResults
      .filter((ruleResult) => ruleResult.ruleHit)
      .map((ruleResults) => ruleResults.ruleInstanceId)

    await background(
      this.ruleInstanceRepository.incrementRuleInstanceStatsCount(
        ruleInstances.map((ruleInstance) => ruleInstance.id as string),
        hitRuleInstanceIds
      )
    )

    const executedAndHitRulesResult = getExecutedAndHitRulesResult(ruleResults)

    const transactionAggregationTasks = verifyTransactionResults.flatMap(
      (result) => compact(result.transactionAggregationTasks)
    )

    updateStatsSegment?.close()
    return {
      ...executedAndHitRulesResult,
      transactionAggregationTasks,
    }
  }

  private async verifyRuleIdempotent(options: {
    rule: Rule
    ruleInstance: RuleInstance
    senderUserRiskLevel: RiskLevel | undefined
    transaction?: Transaction
    database: 'MONGODB' | 'DYNAMODB'
    senderUser?: User | Business
    receiverUser?: User | Business
    ongoingScreeningMode?: boolean
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
      ongoingScreeningMode,
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
          { transaction, senderUser, receiverUser },
          { parameters, filters: ruleFilters },
          { ruleInstance, rule },
          mode,
          this.dynamoDb,
          mode === 'MONGODB' ? await getMongoDbClient() : undefined
        )
      : new (RuleClass as typeof UserRuleBase)(
          this.tenantId,
          { user: senderUser!, ongoingScreeningMode },
          { parameters, filters: ruleFilters },
          await getMongoDbClient(),
          this.dynamoDb
        )

    const segmentNamespace = `Rules Engine - ${ruleInstance.ruleId} (${ruleInstance.id})`
    let filterSegment = undefined
    if (!isEmpty(ruleFilters) && tracing) {
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
    if (!isEmpty(ruleFilters)) {
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
        last(description) !== '.' ? `${description}.` : description
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
  }): Promise<
    | {
        result?: ExecutedRulesResult | undefined
        transactionAggregationTasks?: TransactionAggregationTaskEntry[]
      }
    | undefined
  > {
    const { rule, ruleInstance } = options
    const context = cloneDeep(getContext() || {})
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

        const transactionAggregationTasks =
          ruleClassInstance instanceof TransactionAggregationRule
            ? await this.handleTransactionRuleAggregation(
                ruleClassInstance,
                isTransactionHistoricalFiltered,
                options.transaction.transactionId,
                ruleInstance.id!
              )
            : []
        return {
          result,
          transactionAggregationTasks,
        }
      } catch (e) {
        logger.error(e)
      }
    })
  }

  private async handleTransactionRuleAggregation(
    ruleClassInstance: TransactionAggregationRule<any, any>,
    isTransactionHistoricalFiltered: boolean,
    transactionId: string,
    ruleInstanceId: string
  ): Promise<TransactionAggregationTaskEntry[]> {
    const directions = ['origin', 'destination'] as const
    const transactionAggregationTasks: TransactionAggregationTaskEntry[] = []
    for (const direction of directions) {
      const userKeyId = ruleClassInstance.getUserKeyId(direction)
      if (userKeyId) {
        if (
          hasFeature('RULES_ENGINE_V2') &&
          !(await ruleClassInstance.isRebuilt(direction))
        ) {
          transactionAggregationTasks.push({
            userKeyId,
            payload: {
              direction,
              transactionId,
              ruleInstanceId,
              tenantId: this.tenantId,
              isTransactionHistoricalFiltered,
            },
          })
        } else {
          await background(
            ruleClassInstance.updateAggregation(
              direction,
              isTransactionHistoricalFiltered
            )
          )
        }
      }
    }
    return transactionAggregationTasks
  }

  private async sendTransactionAggregationTasks(
    task: TransactionAggregationTaskEntry
  ) {
    if (envIs('local') || envIs('test')) {
      await handleTransactionAggregationTask(task.payload)
      return
    }

    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(task.payload),
      QueueUrl: process.env.TRANSACTION_AGGREGATION_QUEUE_URL!,
      MessageGroupId: generateChecksum(this.tenantId),
      MessageDeduplicationId: generateChecksum(
        `${task.userKeyId}:${task.payload.ruleInstanceId}:${task.payload.transactionId}`
      ),
    })

    updateLogMetadata(task)
    await sqs.send(command)
    logger.info(`Sent transaction aggregation task to SQS`)
  }

  private async verifyUserRule(options: {
    rule: Rule
    ruleInstance: RuleInstance
    userRiskLevel: RiskLevel | undefined
    user: User | Business
    ongoingScreeningMode?: boolean
  }) {
    const context = cloneDeep(getContext() || {})
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
          ongoingScreeningMode: options.ongoingScreeningMode,
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

  // This returns true if all the boolean promises given resolve to true, it bails
  // as early as possible if any promise resolves to false using `Promise.race`.
  // It defaults to true if no promise is given.
  private async allTrue(promises: Promise<boolean>[]): Promise<boolean> {
    if (promises.length === 0) {
      return true
    }
    const newPromises: Promise<boolean>[] = promises.map(
      (p) =>
        new Promise((resolve, reject) =>
          p.then((v) => !v && resolve(false), reject)
        )
    )
    newPromises.push(Promise.all(promises).then(() => true))
    return Promise.race(newPromises)
  }

  private ruleFilters<
    T extends typeof UserRuleFilterBase | typeof TransactionRuleFilterBase
  >(
    ruleFilters: { [key: string]: any },
    filters: { [key: string]: T },
    data:
      | {
          transaction?: Transaction
          senderUser?: User | Business
          receiverUser?: User | Business
        }
      | {
          user?: User | Business
        }
  ): Promise<boolean> {
    const promises: Promise<boolean>[] = []
    for (const filterKey in ruleFilters) {
      const FilterClass = filters[filterKey]
      const filterParams = ruleFilters[filterKey]
      const paramsIsEmpty =
        isNil(filterParams) || (isObject(filterParams) && isEmpty(filterParams))
      if (FilterClass && !paramsIsEmpty) {
        const isUserFilter = Boolean(USER_FILTERS[filterKey])
        if (isUserFilter && !(data as { user?: User | Business }).user) {
          promises.push(Promise.resolve(false))
        } else {
          const ruleFilter = new FilterClass(
            this.tenantId,
            data as any,
            { [filterKey]: ruleFilters[filterKey] },
            this.dynamoDb
          )
          promises.push(ruleFilter.predicate())
        }
      }
    }
    return this.allTrue(promises)
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
    const isTransactionFiltered = this.ruleFilters(
      ruleFilters,
      TRANSACTION_FILTERS,
      data
    )
    const isTransactionHistoricalFiltered = this.ruleFilters(
      ruleFilters,
      TRANSACTION_HISTORICAL_FILTERS,
      data
    )
    const isOriginUserFiltered = this.ruleFilters(ruleFilters, USER_FILTERS, {
      user: data.senderUser,
    })
    const isDestinationUserFiltered = this.ruleFilters(
      ruleFilters,
      USER_FILTERS,
      {
        user: data.receiverUser,
      }
    )
    return {
      isTransactionFiltered: await isTransactionFiltered,
      isTransactionHistoricalFiltered: await isTransactionHistoricalFiltered,
      isOriginUserFiltered: await isOriginUserFiltered,
      isDestinationUserFiltered: await isDestinationUserFiltered,
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
    if (!user?.userId || !hasFeature('RISK_LEVELS')) {
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
    if (hasFeature('RISK_LEVELS') && ruleInstance.riskLevelParameters) {
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
          const aggregator = new Aggregator(this.tenantId, this.dynamoDb)

          if (
            aggregator.getTargetTransactionState() ===
              transaction.transactionState &&
            !previousTransactionEvents
              .map((event) => event.transactionState)
              .includes(aggregator.getTargetTransactionState())
          ) {
            await aggregator.aggregate(transaction)
          }
        } catch (e) {
          logger.error(
            `Aggregator ${Aggregator.aggregatorName} failed: ${
              (e as Error)?.message
            }`
          )
          logger.error(e)
        }
      })
    )
    logger.info(`Updated global aggregations`)
    updateAggregationsSegment?.close()
  }

  public async applyTransactionAction(
    data: TransactionAction,
    userId: string
  ): Promise<void> {
    const { transactionIds, action, reason } = data
    const txns = await Promise.all(
      transactionIds.map((txnId) => {
        return this.transactionRepository.getTransactionById(txnId)
      })
    )
    if (txns.length === 0) {
      throw new Error('No transactions')
    }

    await Promise.all(
      txns.flatMap((transaction) => {
        if (!transaction) {
          return
        }
        return [
          this.transactionEventRepository.saveTransactionEvent(
            {
              transactionState:
                transaction.transactionState as TransactionState,
              timestamp: Date.now(),
              transactionId: transaction.transactionId,
              eventDescription: `Transaction status was manually changed to ${action} by ${userId}`,
              reason: reason.join(', '),
            },
            {
              status: action,
              hitRules: transaction.hitRules,
              executedRules: transaction.executedRules,
            }
          ),
          this.transactionRepository.saveTransaction(transaction, {
            status: action,
            hitRules: transaction.hitRules,
            executedRules: transaction.executedRules,
          }),
        ]
      })
    )

    const webhooksData: ThinWebhookDeliveryTask<TransactionStatusDetails>[] =
      txns.map((txn) => ({
        event: 'TRANSACTION_STATUS_UPDATED',
        payload: {
          transactionId: txn?.transactionId as string,
          status: action,
          reasons: reason,
        } as TransactionStatusDetails,
      }))

    await sendWebhookTasks<TransactionStatusDetails>(
      this.tenantId,
      webhooksData
    )
  }
}
