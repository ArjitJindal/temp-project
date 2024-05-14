import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import {
  compact,
  Dictionary,
  isEmpty,
  isNil,
  isObject,
  keyBy,
  last,
  map,
  uniqBy,
} from 'lodash'
import { MongoClient } from 'mongodb'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { Subsegment } from 'aws-xray-sdk-core'
import pMap from 'p-map'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { DEFAULT_RISK_LEVEL } from '../risk-scoring/utils'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { sendWebhookTasks, ThinWebhookDeliveryTask } from '../webhook/utils'
import { RiskScoringService } from '../risk-scoring'
import { SanctionsService } from '../sanctions'
import { IBANService } from '../iban'
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
  LegacyFilters,
  TRANSACTION_FILTERS,
  TRANSACTION_HISTORICAL_FILTERS,
  TransactionFilters,
  TransactionRuleFilterBase,
  USER_FILTERS,
  UserFilters,
  UserRuleFilterBase,
} from './filters'
import {
  USER_ONGOING_SCREENING_RULES,
  USER_RULES,
  UserRuleBase,
} from './user-rules'
import { RuleJsonLogicEvaluator } from './v8-engine'
import { getAggVarHash } from './v8-engine/aggregation-repository'
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
  hasFeature,
  publishMetric,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { Rule } from '@/@types/openapi-internal/Rule'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionEventMonitoringResult } from '@/@types/openapi-public/TransactionEventMonitoringResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { RULE_EXECUTION_TIME_MS_METRIC } from '@/core/cloudwatch/metrics'
import { addNewSubsegment, traceable } from '@/core/xray'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { generateChecksum, mergeEntities } from '@/utils/object'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import {
  getAggregatedRuleStatus,
  isV8RuleInstance,
} from '@/services/rules-engine/utils'
import { TransactionStatusDetails } from '@/@types/openapi-public/TransactionStatusDetails'
import { TransactionAction } from '@/@types/openapi-internal/TransactionAction'
import { envIs } from '@/utils/env'
import { handleTransactionAggregationTask } from '@/lambdas/transaction-aggregation/app'
import { ConsumerUsersResponse } from '@/@types/openapi-public/ConsumerUsersResponse'
import { BusinessUsersResponse } from '@/@types/openapi-public/BusinessUsersResponse'
import { TransactionRiskScoringResult } from '@/@types/openapi-public/TransactionRiskScoringResult'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { getSQSClient } from '@/utils/sns-sqs-client'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { ExecutedRuleVars } from '@/@types/openapi-internal/ExecutedRuleVars'

const sqs = getSQSClient()

const ruleAscendingComparator = (
  rule1: HitRulesDetails,
  rule2: HitRulesDetails
) => ((rule1?.ruleId ?? '') > (rule2?.ruleId ?? '') ? 1 : -1)

export type TransactionAggregationTask = {
  transactionId: string
  ruleInstanceId: string
  direction: 'origin' | 'destination'
  tenantId: string
  isTransactionHistoricalFiltered: boolean
}
export type V8TransactionAggregationTask = {
  v8: true
  aggregationVariable: RuleAggregationVariable
  transaction: Transaction
  direction: 'origin' | 'destination'
  tenantId: string
  filters?: LegacyFilters
}
export type TransactionAggregationTaskEntry = {
  userKeyId: string
  payload: TransactionAggregationTask | V8TransactionAggregationTask
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
      isShadow: result?.isShadow,
    }))
    .sort(ruleAscendingComparator) as HitRulesDetails[]

  return {
    executedRules,
    hitRules,
    status: getAggregatedRuleStatus(hitRules),
  }
}

function mergeRules<T extends { ruleInstanceId: string }>(
  existingRulesResult: Array<T>,
  newRulesResults: Array<T>
): Array<T> {
  return uniqBy(
    (newRulesResults ?? []).concat(existingRulesResult ?? []),
    (r) => r.ruleInstanceId
  )
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
  riskScoringService: RiskScoringService
  ruleLogicEvaluator: RuleJsonLogicEvaluator
  sanctionsService: SanctionsService
  ibanService: IBANService

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
    this.riskScoringService = new RiskScoringService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    this.ruleLogicEvaluator = new RuleJsonLogicEvaluator(
      this.tenantId,
      this.dynamoDb
    )
    this.sanctionsService = new SanctionsService(this.tenantId)
    this.ibanService = new IBANService(this.tenantId)
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

  public async verifyAllUsersRules(): Promise<
    Record<string, ConsumerUsersResponse | BusinessUsersResponse>
  > {
    const ruleInstances =
      await this.ruleInstanceRepository.getActiveRuleInstances(
        'USER_ONGOING_SCREENING'
      )

    const rulesByIds = await this.getRulesById(ruleInstances)

    const results = await Promise.all(
      ruleInstances.map(async (ruleInstance) => {
        return await withContext(async () => {
          updateLogMetadata({
            ruleId: ruleInstance.ruleId,
            ruleInstanceId: ruleInstance.id,
          })
          logger.info(`Running rule`)
          const result = await this.verifyAllUsersRule({
            ruleInstance,
            rule: rulesByIds[ruleInstance.ruleId ?? ''],
          })
          logger.info(`Completed rule`)
          return result
        })
      })
    )

    const groupedResults: Record<
      string,
      ConsumerUsersResponse | BusinessUsersResponse
    > = results.flat().reduce((acc, result) => {
      const userDetail = acc[result.userId]
      if (userDetail) {
        userDetail.executedRules?.push(...(result?.executedRules ?? []))
        userDetail.hitRules?.push(...(result?.hitRules ?? []))
      } else {
        acc[result.userId] = {
          ...result,
          executedRules: result.executedRules,
          hitRules: result.hitRules,
        }
      }
      return acc
    }, {})

    return groupedResults
  }

  public async verifyAllUsersRule(data: {
    ruleInstance: RuleInstance
    rule: Rule
  }) {
    const { ruleInstance, rule } = data
    const ruleClass =
      USER_ONGOING_SCREENING_RULES[rule.ruleImplementationName ?? '']

    const hitResults: (ConsumerUsersResponse | BusinessUsersResponse)[] = []

    if (ruleClass) {
      const ruleClassInstance = new ruleClass(
        this.tenantId,
        {
          parameters: ruleInstance.parameters,
          riskLevelParameters: ruleInstance.riskLevelParameters as Record<
            RiskLevel,
            any
          >,
        },
        { ruleInstance, rule },
        { riskRepository: this.riskRepository },
        await getMongoDbClient(),
        this.dynamoDb
      )

      const result = await ruleClassInstance.computeRule()

      if (result) {
        const cursors = result.hitUsersCursors

        for (const cursor of cursors) {
          await processCursorInBatch<InternalUser>(
            cursor,
            async (usersChunk) => {
              await pMap(usersChunk, async (user) => {
                const { isOriginUserFiltered } = await this.computeRuleFilters(
                  ruleInstance.filters as UserFilters,
                  { senderUser: user }
                )

                const { action } = this.getUserSpecificParameters(
                  await this.getUserRiskLevel(user),
                  ruleInstance
                )

                if (isOriginUserFiltered) {
                  const hitRuleResult: HitRulesDetails = {
                    ruleId: rule.id,
                    ruleInstanceId: ruleInstance.id ?? '',
                    ruleName: rule.name,
                    ruleDescription: await generateRuleDescription(
                      rule,
                      ruleClassInstance.getUserOngoingVars()
                    ),
                    ruleAction: action,
                    labels: rule.labels,
                    nature: ruleInstance.nature,
                    ruleHitMeta: {
                      hitDirections: ['ORIGIN'],
                    },
                    isShadow: ruleInstance.mode === 'SHADOW_SYNC',
                  }

                  const result: ConsumerUsersResponse | BusinessUsersResponse =
                    {
                      userId: user.userId,
                      executedRules: [{ ...hitRuleResult, ruleHit: true }],
                      hitRules: [hitRuleResult],
                    }

                  hitResults.push(result)
                }
              })
            }
          )
        }
      }
    }

    return hitResults
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

    const {
      executedRules,
      hitRules,
      transactionAggregationTasks,
      transactionRiskScoreDetails,
    } = await this.verifyTransactionInternal(transaction)

    const riskScoreDetails: TransactionRiskScoringResult | undefined =
      transactionRiskScoreDetails
        ? {
            trsRiskLevel: transactionRiskScoreDetails.riskLevel,
            trsScore: transactionRiskScoreDetails.score,
          }
        : undefined

    const saveTransactionSegment = await addNewSubsegment(
      'Rules Engine',
      'Save Transaction/Event'
    )
    const initialTransactionState = transaction.transactionState || 'CREATED'

    if (hasFeature('SYNC_TRS_CALCULATION') && transactionRiskScoreDetails) {
      await this.riskRepository.createOrUpdateArsScore(
        transaction.transactionId,
        transactionRiskScoreDetails.score,
        transaction.originUserId,
        transaction.destinationUserId,
        transactionRiskScoreDetails.components
      )
    }

    const savedTransaction = await this.transactionRepository.saveTransaction(
      {
        ...transaction,
        transactionState: initialTransactionState,
      },
      {
        status: getAggregatedRuleStatus(hitRules),
        executedRules,
        hitRules,
        riskScoreDetails,
      }
    )

    await this.transactionEventRepository.saveTransactionEvent(
      {
        transactionId: savedTransaction.transactionId as string,
        timestamp: savedTransaction.timestamp as number,
        transactionState: initialTransactionState,
        updatedTransactionAttributes: savedTransaction,
      },
      { executedRules, hitRules, riskScoreDetails }
    )

    saveTransactionSegment?.close()

    await Promise.all([
      ...transactionAggregationTasks.map((task) =>
        this.sendTransactionAggregationTasks(task)
      ),
      this.updateGlobalAggregation(savedTransaction, previousTransactionEvents),
    ])

    return {
      transactionId: savedTransaction.transactionId as string,
      executedRules,
      hitRules,
      status: getAggregatedRuleStatus(hitRules),
      riskScoreDetails,
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

    const {
      executedRules,
      hitRules,
      transactionAggregationTasks,
      transactionRiskScoreDetails,
    } = await this.verifyTransactionInternal(updatedTransaction)

    const riskScoreDetails: TransactionRiskScoringResult | undefined =
      transactionRiskScoreDetails
        ? {
            trsRiskLevel: transactionRiskScoreDetails.riskLevel,
            trsScore: transactionRiskScoreDetails.score,
          }
        : undefined

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
      status: getAggregatedRuleStatus(mergedHitRules),
    })
    saveTransactionSegment?.close()

    // For duplicated transaction events with the same state, we don't re-aggregated
    // but this won't prevent re-aggregation if we have the states like [CREATED, APPROVED, CREATED]
    let updateGlobalAggregationPromise: Promise<void> | undefined = undefined
    if (transaction.transactionState !== updatedTransaction.transactionState) {
      updateGlobalAggregationPromise = this.updateGlobalAggregation(
        updatedTransaction,
        previousTransactionEvents
      )
    }
    await Promise.all([
      ...transactionAggregationTasks.map((sqsMessage) =>
        this.sendTransactionAggregationTasks(sqsMessage)
      ),
      updateGlobalAggregationPromise,
    ])

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
      riskScoreDetails,
    }
  }

  public async verifyTransactionForSimulation(
    transaction: Transaction,
    ruleInstance: RuleInstance
  ): Promise<ExecutedRulesResult> {
    const { senderUser, receiverUser } = await this.getTransactionUsers(
      transaction
    )
    const rule = ruleInstance.ruleId
      ? await this.ruleRepository.getRuleById(ruleInstance.ruleId)
      : undefined
    if (!rule && !isV8RuleInstance(ruleInstance)) {
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
  ): Promise<ConsumerUsersResponse | BusinessUsersResponse> {
    const ruleInstances =
      await this.ruleInstanceRepository.getActiveRuleInstances('USER')

    const rules = await this.ruleRepository.getRulesByIds(
      ruleInstances
        .map((ruleInstance) => ruleInstance.ruleId)
        .filter(Boolean) as string[]
    )

    return this.verifyUserByRules(user, ruleInstances, rules, options)
  }

  public async verifyUserByRules(
    user: UserWithRulesResult | BusinessWithRulesResult,
    ruleInstances: readonly RuleInstance[],
    rules: readonly Rule[],
    options?: { ongoingScreeningMode?: boolean }
  ): Promise<ConsumerUsersResponse | BusinessUsersResponse> {
    const rulesById = keyBy(rules, 'id')
    logger.info(`Running rules`)
    const userRiskLevel = await this.getUserRiskLevel(user)
    const ruleResults = (
      await Promise.all(
        ruleInstances.map(async (ruleInstance) =>
          this.verifyUserRule({
            rule: ruleInstance.ruleId
              ? rulesById[ruleInstance.ruleId]
              : undefined,
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

  private async getRulesById(
    ruleInstances: readonly RuleInstance[]
  ): Promise<Dictionary<Rule>> {
    const ruleIds = compact(
      ruleInstances.map((ruleInstance) => ruleInstance.ruleId)
    )

    const rules = await this.ruleRepository.getRulesByIds(ruleIds)
    return keyBy(rules, 'id')
  }

  private async verifyTransactionInternal(transaction: Transaction): Promise<{
    executedRules: ExecutedRulesResult[]
    hitRules: HitRulesDetails[]
    transactionAggregationTasks: TransactionAggregationTaskEntry[]
    transactionRiskScoreDetails?: {
      score: number
      riskLevel: RiskLevel
      components: RiskScoreComponent[]
    }
  }> {
    const getInitialDataSegment = await addNewSubsegment(
      'Rules Engine',
      'Get Initial Data'
    )

    const { senderUser, receiverUser } = await this.getTransactionUsers(
      transaction
    )
    const senderUserRiskLevelPromise = this.getUserRiskLevel(senderUser)
    const transactionRiskDetails = hasFeature('SYNC_TRS_CALCULATION')
      ? this.riskScoringService.calculateArsScore(transaction)
      : undefined

    const [ruleInstances, transactionRisk] = await Promise.all([
      this.ruleInstanceRepository.getActiveRuleInstances('TRANSACTION'),
      transactionRiskDetails,
    ])

    const rulesById = await this.getRulesById(ruleInstances)

    getInitialDataSegment?.close()

    const runRulesSegment = await addNewSubsegment('Rules Engine', 'Run Rules')
    logger.info(`Running rules`)

    const verifyTransactionResults = compact(
      await Promise.all(
        ruleInstances.map(async (ruleInstance) =>
          this.verifyTransactionRule({
            rule: ruleInstance.ruleId
              ? rulesById[ruleInstance.ruleId]
              : undefined,
            ruleInstance,
            senderUserRiskLevel: await senderUserRiskLevelPromise,
            transaction,
            senderUser,
            receiverUser,
            transactionRiskScore: transactionRisk?.score,
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

    await this.ruleInstanceRepository.incrementRuleInstanceStatsCount(
      ruleInstances.map((ruleInstance) => ruleInstance.id as string),
      hitRuleInstanceIds
    )

    const executedAndHitRulesResult = getExecutedAndHitRulesResult(ruleResults)

    const transactionAggregationTasks = verifyTransactionResults.flatMap(
      (result) => compact(result.transactionAggregationTasks)
    )

    updateStatsSegment?.close()
    const riskDetails = await transactionRiskDetails
    this.updatedAggregationVariables.clear()
    return {
      ...executedAndHitRulesResult,
      transactionAggregationTasks,
      ...(riskDetails && {
        transactionRiskScoreDetails: {
          riskLevel: riskDetails.riskLevel,
          score: riskDetails.score,
          components: riskDetails.components,
        },
      }),
    }
  }

  public async verifyRuleIdempotent(options: {
    rule?: Rule
    ruleInstance: RuleInstance
    senderUserRiskLevel?: RiskLevel
    transaction?: Transaction
    database: 'MONGODB' | 'DYNAMODB'
    senderUser?: User | Business
    receiverUser?: User | Business
    ongoingScreeningMode?: boolean
    tracing?: boolean
    transactionRiskScore?: number
  }): Promise<{
    ruleClassInstance: TransactionRuleBase | UserRuleBase | undefined
    isTransactionHistoricalFiltered: boolean
    result: ExecutedRulesResult
  }> {
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
      transactionRiskScore,
    } = options
    const { parameters, logic, action } = this.getUserSpecificParameters(
      senderUserRiskLevel,
      ruleInstance
    )
    const ruleFilters = ruleInstance.filters as TransactionFilters & UserFilters
    const mode =
      database === 'MONGODB' || process.env.__INTERNAL_MONGODB_MIRROR__
        ? 'MONGODB'
        : 'DYNAMODB'
    this.ruleLogicEvaluator.setMode(mode)

    // NOTE: We allow having origin/destination ID in a transaction even if the user with the
    // user ID is not created (FR-1331). When running the rules, we identify a user either using
    // user ID or the payment details, and it makes no sense to use the user ID without user entity
    // becuase we only create a case for a known user or a payment identifier (external user).
    // Thus we reset transaction user ID to undefined if no known user can be found.
    const transactionWithValidUserId = transaction && {
      ...transaction,
      originUserId: senderUser ? transaction.originUserId : undefined,
      destinationUserId: receiverUser
        ? transaction.destinationUserId
        : undefined,
    }
    const segmentNamespace = `Rules Engine - ${ruleInstance.ruleId} (${ruleInstance.id})`

    let ruleClassInstance: TransactionRuleBase | UserRuleBase | undefined
    let isTransactionHistoricalFiltered = false
    let isOriginUserFiltered = true
    let isDestinationUserFiltered = true
    let ruleResult: RuleHitResult | undefined
    let vars: ExecutedRuleVars[] | undefined
    if (hasFeature('RULES_ENGINE_V8') && logic) {
      if (transactionWithValidUserId) {
        const {
          hit,
          hitDirections,
          vars: ruleVars,
        } = await this.ruleLogicEvaluator.evaluate(
          logic,
          ruleInstance.logicAggregationVariables ?? [],
          {
            baseCurrency: ruleInstance.baseCurrency,
            tenantId: this.tenantId,
          },
          {
            transaction: transactionWithValidUserId,
            senderUser,
            receiverUser,
          }
        )
        vars = ruleVars
        const finalHitDirections = this.getFinalHitDirections(
          hitDirections,
          ruleInstance.alertConfig?.alertCreationDirection ?? 'AUTO'
        )
        if (hit) {
          ruleResult = finalHitDirections.map((direction) => ({ direction }))
        }
      }
    } else {
      const ruleImplementationName = rule?.ruleImplementationName ?? ''
      const RuleClass = transaction
        ? TRANSACTION_RULES[ruleImplementationName]
        : USER_RULES[ruleImplementationName]
      if (!RuleClass) {
        throw new Error(
          `${ruleImplementationName} rule implementation not found!`
        )
      }
      if (!rule) throw new Error('Rule not found')
      ruleClassInstance = transactionWithValidUserId
        ? new (RuleClass as typeof TransactionRuleBase)(
            this.tenantId,
            {
              transaction: transactionWithValidUserId,
              senderUser,
              receiverUser,
              transactionRiskScore,
            },
            { parameters, filters: ruleFilters },
            { ruleInstance, rule: rule },
            {
              sanctionsService: this.sanctionsService,
              ibanService: this.ibanService,
            },
            mode,
            this.dynamoDb,
            mode === 'MONGODB' ? await getMongoDbClient() : undefined
          )
        : new (RuleClass as typeof UserRuleBase)(
            this.tenantId,
            { user: senderUser ?? ({} as User), ongoingScreeningMode },
            { parameters, filters: ruleFilters },
            { ruleInstance, rule: rule },
            {
              sanctionsService: this.sanctionsService,
              ibanService: this.ibanService,
            },
            await getMongoDbClient(),
            this.dynamoDb
          )
      let filterSegment: any = undefined
      if (!isEmpty(ruleFilters) && tracing) {
        filterSegment = await addNewSubsegment(
          segmentNamespace,
          'Rule Filtering'
        )
      }
      const filtersResult = await this.computeRuleFilters(ruleFilters, {
        transaction,
        senderUser,
        receiverUser,
      })
      isTransactionHistoricalFiltered =
        filtersResult.isTransactionHistoricalFiltered
      isOriginUserFiltered = filtersResult.isOriginUserFiltered
      isDestinationUserFiltered = filtersResult.isDestinationUserFiltered

      const shouldRunRule =
        filtersResult.isTransactionFiltered &&
        (isOriginUserFiltered || isDestinationUserFiltered)

      if (!isEmpty(ruleFilters)) {
        filterSegment?.close()
      }

      let runSegment: Subsegment | undefined = undefined
      if (shouldRunRule && tracing) {
        runSegment = await addNewSubsegment(segmentNamespace, 'Rule Execution')
      }

      ruleResult = shouldRunRule
        ? await ruleClassInstance.computeRule()
        : undefined
      runSegment?.close()
    }

    const filteredRuleResult = ruleResult
      ? this.getFilteredRuleResult(
          ruleResult,
          ruleFilters,
          isOriginUserFiltered,
          isDestinationUserFiltered
        )
      : []

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
    let ruleDescription = ruleInstance.ruleDescriptionAlias || ''

    if (!ruleDescription && rule) {
      const ruleDescriptions = (
        ruleHit
          ? await Promise.all(
              filteredRuleResult?.map((result) =>
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
        ruleInstanceId: ruleInstance.id ?? '',
        ruleName: (ruleInstance.ruleNameAlias || rule?.name) ?? '',
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
              isOngoingScreeningHit: ongoingScreeningMode,
            }
          : undefined,
        vars,
        isShadow: ruleInstance.mode === 'SHADOW_SYNC',
      },
    }
  }

  private updatedAggregationVariables: Set<string> = new Set()

  private async verifyTransactionRule(options: {
    rule?: Rule
    ruleInstance: RuleInstance
    senderUserRiskLevel: RiskLevel | undefined
    transaction: Transaction
    senderUser?: User | Business
    receiverUser?: User | Business
    transactionRiskScore?: number
  }): Promise<
    | {
        result?: ExecutedRulesResult | undefined
        transactionAggregationTasks?: TransactionAggregationTaskEntry[]
      }
    | undefined
  > {
    const { ruleInstance } = options
    const context = getContext()
    return withContext(
      async () => {
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

          if (hasFeature('RULES_ENGINE_V8')) {
            await Promise.all(
              ruleInstance.logicAggregationVariables?.flatMap(
                async (aggVar) => {
                  const hash = getAggVarHash(aggVar)
                  if (this.updatedAggregationVariables.has(hash)) {
                    return
                  }

                  this.updatedAggregationVariables.add(hash)

                  return [
                    aggVar.transactionDirection !== 'RECEIVING'
                      ? await this.ruleLogicEvaluator.updateAggregationVariable(
                          aggVar,
                          { transaction: options.transaction },
                          'origin'
                        )
                      : undefined,
                    aggVar.transactionDirection !== 'SENDING'
                      ? await this.ruleLogicEvaluator.updateAggregationVariable(
                          aggVar,
                          { transaction: options.transaction },
                          'destination'
                        )
                      : undefined,
                  ].filter(Boolean)
                }
              ) ?? []
            )
          }

          const transactionAggregationTasks =
            ruleClassInstance instanceof TransactionAggregationRule
              ? await this.handleTransactionRuleAggregation(
                  ruleClassInstance,
                  isTransactionHistoricalFiltered,
                  options.transaction,
                  ruleInstance.id ?? ''
                )
              : []

          return {
            result,
            transactionAggregationTasks,
          }
        } catch (e) {
          logger.error(e)
        }
      },
      {
        ...context,
        metricDimensions: {
          ...context?.metricDimensions,
          ruleId: ruleInstance.ruleId,
          ruleInstanceId: ruleInstance.id,
        },
      }
    )
  }

  private async handleTransactionRuleAggregation(
    ruleClassInstance: TransactionAggregationRule<any, any>,
    isTransactionHistoricalFiltered: boolean,
    transaction: Transaction,
    ruleInstanceId: string
  ): Promise<TransactionAggregationTaskEntry[]> {
    if (!ruleClassInstance.shouldUseAggregation()) {
      return []
    }

    const directions = ['origin', 'destination'] as const
    const transactionAggregationTasks: TransactionAggregationTaskEntry[] = []
    for (const direction of directions) {
      const shouldUpdateAggregation =
        ruleClassInstance.shouldUpdateUserAggregation(
          direction,
          isTransactionHistoricalFiltered
        )

      // NOTE: This is a quick workaround fix to avoid updating aggregation when it's unnecessary.
      // Eventually the whole `handleTransactionRuleAggregation` will be removed after we migrate all the
      // rules to V8
      const { checkSender, checkReceiver } = ruleClassInstance.parameters ?? {}
      const skipUpdateAggregation =
        (direction === 'origin' &&
          checkSender === 'none' &&
          checkReceiver &&
          checkReceiver !== 'all') ||
        (direction === 'destination' &&
          checkReceiver === 'none' &&
          checkSender &&
          checkSender !== 'all')

      if (shouldUpdateAggregation && !skipUpdateAggregation) {
        const userKeyId = ruleClassInstance.getUserKeyId(direction)
        if (userKeyId) {
          if (!(await ruleClassInstance.isRebuilt(direction))) {
            transactionAggregationTasks.push({
              userKeyId,
              payload: {
                direction,
                transactionId: transaction.transactionId,
                ruleInstanceId,
                tenantId: this.tenantId,
                isTransactionHistoricalFiltered,
              },
            })
          } else {
            await ruleClassInstance.updateAggregation(
              direction,
              isTransactionHistoricalFiltered
            )
          }
        }
      }
    }
    return transactionAggregationTasks
  }

  private async sendTransactionAggregationTasks(
    task: TransactionAggregationTaskEntry
  ) {
    const payload = task.payload as TransactionAggregationTask
    if (envIs('local') || envIs('test')) {
      await handleTransactionAggregationTask(payload)
      return
    }

    const command = new SendMessageCommand({
      MessageBody: JSON.stringify(task.payload),
      QueueUrl: process.env.TRANSACTION_AGGREGATION_QUEUE_URL,
      MessageGroupId: generateChecksum(task.userKeyId),
      MessageDeduplicationId: generateChecksum(
        `${task.userKeyId}:${payload.ruleInstanceId}:${payload.transactionId}`
      ),
    })

    updateLogMetadata(task)
    await sqs.send(command)
    logger.info(`Sent transaction aggregation task to SQS`)
  }

  private async verifyUserRule(options: {
    rule?: Rule
    ruleInstance: RuleInstance
    userRiskLevel: RiskLevel | undefined
    user: User | Business
    ongoingScreeningMode?: boolean
  }) {
    return withContext(async () => {
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

  public async computeRuleFilters(
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
      { user: data.receiverUser }
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
    logic?: object
    parameters: object
    action: RuleAction
  } {
    const riskEnabled = hasFeature('RISK_LEVELS')
    const riskLevel = userRiskLevel || DEFAULT_RISK_LEVEL
    return {
      logic:
        (riskEnabled && ruleInstance.riskLevelLogic?.[riskLevel]) ||
        ruleInstance.logic,
      parameters:
        (riskEnabled && ruleInstance.riskLevelParameters?.[riskLevel]) ||
        ruleInstance.parameters,
      action: ((riskEnabled && ruleInstance.riskLevelActions?.[riskLevel]) ||
        ruleInstance.action) as RuleAction,
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
    const { transactionIds, action, reason, comment } = data
    const txns = await Promise.all(
      transactionIds.map((txnId) => {
        return this.transactionRepository.getTransactionById(txnId)
      })
    )
    if (txns.length === 0) {
      throw new Error('No transactions')
    }

    const transactionsNotFound = transactionIds.filter(
      (txnId) => !txns.find((txn) => txn?.transactionId === txnId)
    )

    if (transactionsNotFound.length) {
      throw new Error(
        `Transactions not found: ${transactionsNotFound.join(', ')}`
      )
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
        triggeredBy: 'MANUAL',
        payload: {
          transactionId: txn?.transactionId as string,
          status: action,
          reasons: reason,
          comment,
        } as TransactionStatusDetails,
      }))

    await sendWebhookTasks<TransactionStatusDetails>(
      this.tenantId,
      webhooksData
    )
  }

  private getFinalHitDirections(
    hitDirections: RuleHitDirection[],
    alertCreationDirection: AlertCreationDirection
  ): RuleHitDirection[] {
    switch (alertCreationDirection) {
      case 'AUTO':
        return hitDirections
      case 'AUTO_ORIGIN':
        return hitDirections.includes('ORIGIN') ? ['ORIGIN'] : []
      case 'AUTO_DESTINATION':
        return hitDirections.includes('DESTINATION') ? ['DESTINATION'] : []
      case 'ORIGIN':
        return ['ORIGIN']
      case 'DESTINATION':
        return ['DESTINATION']
      case 'ALL':
        return ['ORIGIN', 'DESTINATION']
    }
  }
}
