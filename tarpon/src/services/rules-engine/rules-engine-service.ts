import { v4 as uuidv4 } from 'uuid'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { BadRequest, NotFound } from 'http-errors'
import {
  compact,
  Dictionary,
  isEmpty,
  isNil,
  isObject,
  keyBy,
  last,
  map,
  omit,
  pick,
} from 'lodash'
import { MongoClient } from 'mongodb'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Subsegment } from 'aws-xray-sdk-core'
import pMap from 'p-map'
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { UserRepository } from '../users/repositories/user-repository'
import { DEFAULT_RISK_LEVEL } from '../risk-scoring/utils'
import { TenantRepository } from '../tenants/repositories/tenant-repository'
import { sendWebhookTasks, ThinWebhookDeliveryTask } from '../webhook/utils'
import { SanctionsService } from '../sanctions'
import { GeoIPService } from '../geo-ip'
import {
  LogicEvaluator,
  TransactionLogicData,
  UserLogicData,
} from '../logic-evaluator/engine'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
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
import { TransactionWithRiskDetails } from './repositories/transaction-repository-interface'
import { mergeRules } from './utils/rule-utils'
import { getTransactionRiskScoreDetailsForPNB } from './pnb-custom-logic'
import { isRuleInstanceUpdateOrOnboarding } from './utils/user-rule-utils'
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
  hasFeature,
  publishMetric,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
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
  isAsyncRule,
  isShadowRule,
  isSyncRule,
  isV2ScreeningRule,
  isV8RuleInstance,
  runOnV8Engine,
  sendAsyncRuleTasks,
  sendTransactionAggregationTasks,
} from '@/services/rules-engine/utils'
import { TransactionStatusDetails } from '@/@types/openapi-public/TransactionStatusDetails'
import { TransactionAction } from '@/@types/openapi-internal/TransactionAction'
import { ConsumerUserMonitoringResult } from '@/@types/openapi-public/ConsumerUserMonitoringResult'
import { BusinessUserMonitoringResult } from '@/@types/openapi-public/BusinessUserMonitoringResult'
import { TransactionRiskScoringResult } from '@/@types/openapi-public/TransactionRiskScoringResult'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { FifoSqsMessage } from '@/utils/sns-sqs-client'
import { AlertCreationDirection } from '@/@types/openapi-internal/AlertCreationDirection'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { ExecutedLogicVars } from '@/@types/openapi-internal/ExecutedLogicVars'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'
import { RuleMode } from '@/@types/openapi-internal/RuleMode'
import { RuleStage } from '@/@types/openapi-internal/RuleStage'
import { AccountsService } from '@/services/accounts'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'

const ruleAscendingComparator = (
  rule1: HitRulesDetails,
  rule2: HitRulesDetails
) => ((rule1?.ruleId ?? '') > (rule2?.ruleId ?? '') ? 1 : -1)

type RiskScoreDetails = TransactionRiskScoringResult & {
  components?: RiskScoreComponent[]
}

export type TransactionAggregationTask = {
  transactionId: string
  ruleInstanceId: string
  direction: 'origin' | 'destination'
  tenantId: string
  isTransactionHistoricalFiltered: boolean
}
export type V8TransactionAggregationTask = {
  type: 'TRANSACTION_AGGREGATION'
  tenantId: string
  aggregationVariable?: LogicAggregationVariable
  transaction: Transaction
  direction?: 'origin' | 'destination'
  filters?: LegacyFilters
  transactionRiskScore?: number
}
export type V8LogicAggregationRebuildTask = {
  type: 'PRE_AGGREGATION'
  tenantId: string
  entity?:
    | { type: 'RULE'; ruleInstanceId: string }
    | { type: 'RISK_FACTOR'; riskFactorId: string }
  jobId: string
  aggregationVariable: LogicAggregationVariable
  currentTimestamp: number
  userId?: string
  paymentDetails?: PaymentDetails
}

export type TransactionAggregationTaskEntry = {
  userKeyId: string
  payload:
    | TransactionAggregationTask
    | V8TransactionAggregationTask
    | V8LogicAggregationRebuildTask
}

type ValidationOptions = {
  validateTransactionId?: boolean
  validateOriginUserId?: boolean
  validateDestinationUserId?: boolean
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
      executedAt: Date.now(),
    }))
    .sort(ruleAscendingComparator) as HitRulesDetails[]

  return {
    executedRules,
    hitRules,
    status: getAggregatedRuleStatus(hitRules),
  }
}

export type DuplicateTransactionReturnType = TransactionMonitoringResult & {
  message: string
}

@traceable
export class RulesEngineService {
  tenantId: string
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  transactionRepository: DynamoDbTransactionRepository
  transactionEventRepository: TransactionEventRepository
  ruleRepository: RuleRepository
  ruleInstanceRepository: RuleInstanceRepository
  riskRepository: RiskRepository
  userRepository: UserRepository
  tenantRepository: TenantRepository
  riskScoringV8Service: RiskScoringV8Service
  ruleLogicEvaluator: LogicEvaluator
  sanctionsService: SanctionsService
  geoIpService: GeoIPService
  accountsService: AccountsService
  constructor(
    tenantId: string,
    dynamoDb: DynamoDBDocumentClient,
    logicEvaluator: LogicEvaluator,
    mongoDb: MongoClient
  ) {
    // this need to be changed
    this.dynamoDb = dynamoDb
    this.mongoDb = mongoDb
    this.tenantId = tenantId
    this.ruleLogicEvaluator = logicEvaluator
    this.transactionRepository = new DynamoDbTransactionRepository(
      tenantId,
      dynamoDb
    )
    this.transactionEventRepository = new TransactionEventRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })
    this.ruleRepository = new RuleRepository(tenantId, {
      dynamoDb,
    })
    this.accountsService = new AccountsService(
      {
        auth0Domain: getContext()?.auth0Domain ?? '',
      },
      { dynamoDb }
    )
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
    this.riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    this.sanctionsService = new SanctionsService(this.tenantId, {
      mongoDb,
      dynamoDb,
    })
    this.geoIpService = new GeoIPService(this.tenantId, dynamoDb)
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ): Promise<RulesEngineService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const mongoDb = await getMongoDbClient()
    return new RulesEngineService(tenantId, dynamoDb, logicEvaluator, mongoDb)
  }

  public async verifyAllUsersRules(): Promise<
    Record<string, ConsumerUserMonitoringResult | BusinessUserMonitoringResult>
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
          logger.debug(`Running rule`)
          const result = await this.verifyAllUsersRule(
            {
              ruleInstance,
              rule: rulesByIds[ruleInstance.ruleId ?? ''],
            },
            'ONGOING'
          )
          logger.debug(`Completed rule`)
          return result
        })
      })
    )

    const groupedResults: Record<
      string,
      ConsumerUserMonitoringResult | BusinessUserMonitoringResult
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

  public async verifyAllUsersRule(
    data: {
      ruleInstance: RuleInstance
      rule: Rule
    },
    stage: RuleStage
  ) {
    const { ruleInstance, rule } = data
    const ruleClass =
      USER_ONGOING_SCREENING_RULES[rule.ruleImplementationName ?? '']

    const hitResults: (
      | ConsumerUserMonitoringResult
      | BusinessUserMonitoringResult
    )[] = []

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
        this.dynamoDb,
        stage
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
                const { riskLevel } = await this.getUserRiskLevelAndScore(
                  user?.userId
                )
                const { action } = this.getUserSpecificParameters(
                  riskLevel,
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
                    isShadow: isShadowRule(ruleInstance),
                  }

                  const result:
                    | ConsumerUserMonitoringResult
                    | BusinessUserMonitoringResult = {
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

  private getRiskScoreDetails(
    hitRules: HitRulesDetails[],
    userRiskScoreDetails,
    transactionRiskDetails
  ) {
    const hasPNBFeature = hasFeature('PNB')
    const userRiskScoreDetailsToReturn = hasPNBFeature
      ? getTransactionRiskScoreDetailsForPNB(hitRules, userRiskScoreDetails) ??
        {}
      : userRiskScoreDetails
    return {
      ...transactionRiskDetails,
      ...userRiskScoreDetailsToReturn,
    }
  }

  public async verifyTransaction(
    transaction: Transaction,
    options?: ValidationOptions
  ): Promise<TransactionMonitoringResult | DuplicateTransactionReturnType> {
    if (transaction.transactionId && (options?.validateTransactionId ?? true)) {
      const existingTransaction =
        await this.transactionRepository.getTransactionById(
          transaction.transactionId
        )
      if (existingTransaction) {
        const [originUserDrs, destinationUserDrs] = await Promise.all([
          existingTransaction.originUserId
            ? this.riskScoringV8Service.getDrsScore(
                existingTransaction.originUserId
              )
            : Promise.resolve(null),
          existingTransaction.destinationUserId
            ? this.riskScoringV8Service.getDrsScore(
                existingTransaction.destinationUserId
              )
            : Promise.resolve(null),
        ])
        const riskClassificationValues =
          await this.riskRepository.getRiskClassificationValues()
        const userRiskScoreDetails = {
          originUserCraRiskScore: originUserDrs?.drsScore,
          destinationUserCraRiskScore: destinationUserDrs?.drsScore,
          originUserCraRiskLevel: originUserDrs?.drsScore
            ? getRiskLevelFromScore(
                riskClassificationValues,
                originUserDrs.drsScore
              )
            : undefined,
          destinationUserCraRiskLevel: destinationUserDrs?.drsScore
            ? getRiskLevelFromScore(
                riskClassificationValues,
                destinationUserDrs.drsScore
              )
            : undefined,
        }
        return {
          transactionId: transaction.transactionId,
          message:
            'The provided transactionId already exists. No rules were run. If you want to update the attributes of this transaction, please use transaction events instead.',
          executedRules: existingTransaction.executedRules,
          hitRules: existingTransaction.hitRules,
          status: existingTransaction.status,
          riskScoreDetails: existingTransaction.riskScoreDetails
            ? this.getRiskScoreDetails(
                existingTransaction.hitRules,
                userRiskScoreDetails,
                existingTransaction.riskScoreDetails
              )
            : undefined,
        }
      }
    }

    const initialTransactionEvent = this.getInitialTransactionEvent(transaction)

    const {
      executedRules,
      hitRules,
      aggregationMessages,
      riskScoreDetails,
      senderUser = null,
      receiverUser = null,
      isAnyAsyncRules,
      userRiskScoreDetails,
    } = await this.verifyTransactionInternal(
      transaction,
      [initialTransactionEvent],
      'INITIAL',
      undefined,
      options
    )

    const saveTransactionSegment = await addNewSubsegment(
      'Rules Engine',
      'Save Transaction/Event'
    )

    const transactionToSave = {
      ...transaction,
      transactionState: initialTransactionEvent.transactionState,
    }

    await this.transactionEventRepository.saveTransactionEvent(
      {
        ...initialTransactionEvent,
        updatedTransactionAttributes: transactionToSave,
      },
      { executedRules, hitRules, riskScoreDetails }
    )
    const savedTransaction = await this.transactionRepository.saveTransaction(
      transactionToSave,
      {
        status: getAggregatedRuleStatus(hitRules),
        executedRules,
        hitRules,
        riskScoreDetails,
      }
    )

    saveTransactionSegment?.close()

    try {
      await Promise.all([
        sendTransactionAggregationTasks(
          aggregationMessages,
          this.dynamoDb,
          this.mongoDb
        ),
        this.updateGlobalAggregation(savedTransaction, []),
        isAnyAsyncRules &&
          sendAsyncRuleTasks([
            {
              tenantId: this.tenantId,
              type: 'TRANSACTION',
              transaction: omit<Transaction>(savedTransaction, [
                'executedRules',
                'hitRules',
              ]) as Transaction,
              senderUser: omit<User>(senderUser, [
                'executedRules',
                'hitRules',
              ]) as User | Business,
              receiverUser: omit<User>(receiverUser, [
                'executedRules',
                'hitRules',
              ]) as User | Business,
            },
          ]),
      ])
    } catch (e) {
      logger.error(e)
    }
    return {
      transactionId: savedTransaction.transactionId as string,
      executedRules,
      hitRules,
      status: getAggregatedRuleStatus(hitRules),
      ...(riskScoreDetails
        ? {
            riskScoreDetails: this.getRiskScoreDetails(
              hitRules,
              userRiskScoreDetails,
              riskScoreDetails
            ),
          }
        : {}),
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
      aggregationMessages,
      riskScoreDetails,
      senderUser = null,
      receiverUser = null,
      isAnyAsyncRules,
      userRiskScoreDetails,
    } = await this.verifyTransactionInternal(
      updatedTransaction,
      previousTransactionEvents.concat(
        transactionEvent as TransactionEventWithRulesResult
      ),
      'UPDATE'
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
        riskScoreDetails,
        status: getAggregatedRuleStatus(hitRules),
      }
    )
    // Update transaction with the latest payload.
    const mergedHitRules = mergeRules(updatedTransaction.hitRules, hitRules)
    /**
     * We should only derive the status from the hit rules, not the merged hit rules because we should take info from new rule
     * Use case:
     *  - Create a rule which is triggered when the transaction is CREATED and it changes status to SUSPEND
     *  - Transaction goes to payment approvals and transaction is approved and status is changed to ALLOW
     *  - The customer recives a webhook and updates the transaction state to PROCESSING
     *  In current logic we merge the hit rules and we will still get the status as SUSPEND
     *  But ideally we should not update the status since no rule was hit in a trasnaction event
     *  Hence we will derive from hit rules instead of merged hit rules
     */
    const transactionStatus = getAggregatedRuleStatus(hitRules)
    await this.transactionRepository.saveTransaction(updatedTransaction, {
      executedRules: mergeRules(
        updatedTransaction.executedRules,
        executedRules
      ),
      hitRules: mergedHitRules,
      status: transactionStatus,
      riskScoreDetails,
      transactionId: transaction.transactionId,
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
      sendTransactionAggregationTasks(
        aggregationMessages,
        this.dynamoDb,
        this.mongoDb
      ),
      updateGlobalAggregationPromise,
      isAnyAsyncRules &&
        sendAsyncRuleTasks([
          {
            tenantId: this.tenantId,
            type: 'TRANSACTION_EVENT',
            updatedTransaction: omit<Transaction>(updatedTransaction, [
              'executedRules',
              'hitRules',
            ]) as Transaction,
            senderUser: omit<User>(senderUser, [
              'executedRules',
              'hitRules',
            ]) as User | Business,
            receiverUser: omit<User>(receiverUser, [
              'executedRules',
              'hitRules',
            ]) as User | Business,
            transactionEventId: eventId,
          },
        ]),
    ])

    const updatedTransactionWithoutRulesResult = {
      ...updatedTransaction,
      status: transactionStatus,
      executedRules: undefined,
      hitRules: undefined,
    }

    return {
      eventId,
      transaction: updatedTransactionWithoutRulesResult,
      executedRules,
      hitRules,
      ...(riskScoreDetails
        ? {
            riskScoreDetails: hasFeature('PNB')
              ? {
                  ...riskScoreDetails,
                  ...getTransactionRiskScoreDetailsForPNB(
                    hitRules,
                    userRiskScoreDetails
                  ),
                }
              : {
                  ...riskScoreDetails,
                  ...userRiskScoreDetails,
                },
          }
        : {}),
    }
  }

  public async verifyTransactionForSimulation(
    transaction: Transaction,
    ruleInstance: RuleInstance,
    stage: RuleStage
  ): Promise<ExecutedRulesResult> {
    const rule = ruleInstance.ruleId
      ? await this.ruleRepository.getRuleById(ruleInstance.ruleId)
      : undefined
    if (!rule && !isV8RuleInstance(ruleInstance)) {
      throw new Error(`Cannot find rule ${ruleInstance.ruleId}`)
    }
    const { senderUser, receiverUser } = await this.getTransactionUsers(
      transaction
    )
    const { riskLevel: senderUserRiskLevel } =
      await this.getUserRiskLevelAndScore(senderUser?.userId)
    const { result } = await this.verifyRuleIdempotent({
      rule,
      ruleInstance,
      senderUserRiskLevel,
      transaction,
      senderUser,
      receiverUser,
      stage,
      database: 'MONGODB',
    })
    return result
  }

  public async verifyUser(
    user: UserWithRulesResult | BusinessWithRulesResult,
    stage: RuleStage,
    options?: { async?: boolean }
  ): Promise<{
    monitoringResult:
      | ConsumerUserMonitoringResult
      | BusinessUserMonitoringResult
    isAnyAsyncRules: boolean
  }> {
    const { async = false } = options ?? {}
    const ruleInstances =
      await this.ruleInstanceRepository.getActiveRuleInstances('USER')
    const targetRuleInstances = ruleInstances.filter(
      (r) =>
        isRuleInstanceUpdateOrOnboarding(r, stage, hasFeature('RISK_LEVELS')) &&
        (async ? isAsyncRule(r) : isSyncRule(r))
    )

    const rules = await this.ruleRepository.getRulesByIds(
      targetRuleInstances
        .map((ruleInstance) => ruleInstance.ruleId)
        .filter(Boolean) as string[]
    )
    return {
      monitoringResult: await this.verifyUserByRules(
        user,
        targetRuleInstances,
        rules,
        stage
      ),
      isAnyAsyncRules: ruleInstances.some(isAsyncRule),
    }
  }

  public async verifyUserByRules(
    user: UserWithRulesResult | BusinessWithRulesResult,
    ruleInstances: readonly RuleInstance[],
    rules: readonly Rule[],
    stage: RuleStage
  ): Promise<ConsumerUserMonitoringResult | BusinessUserMonitoringResult> {
    const rulesById = keyBy(rules, 'id')
    logger.debug(`Running rules`)
    const { riskLevel: userRiskLevel } = await this.getUserRiskLevelAndScore(
      user?.userId
    )
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
            stage,
          })
        )
      )
    ).filter(Boolean) as ExecutedRulesResult[]

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

  private isMoreSevereAction(
    action1: RuleAction,
    action2: RuleAction
  ): boolean {
    return RULE_ACTIONS.indexOf(action1) < RULE_ACTIONS.indexOf(action2)
  }

  private async verifyAsyncRulesTransactionInternal(
    transaction: Transaction,
    transactionEvents: TransactionEvent[],
    ruleStage: RuleStage,
    senderUser?: User | Business,
    receiverUser?: User | Business,
    riskDetails?: TransactionRiskScoringResult,
    oldStatusTransactionEvent?: RuleAction
  ): Promise<void> {
    const transactionInDb = await this.transactionRepository.getTransactionById(
      transaction.transactionId
    )
    if (!transactionInDb) {
      throw new NotFound(
        `Transaction ${transaction.transactionId} not found when verifying async rules`
      )
    }
    const oldStatus = oldStatusTransactionEvent ?? transactionInDb?.status
    const relatedData = {
      transactionRiskDetails: riskDetails,
      senderUser: senderUser ?? undefined,
      receiverUser: receiverUser ?? undefined,
    }

    const data = await this.verifyTransactionInternal(
      transaction,
      transactionEvents,
      ruleStage,
      relatedData
    )

    const { executedRules, hitRules, aggregationMessages } = data
    const mergedExecutedRules = mergeRules(
      transactionInDb.executedRules,
      executedRules
    )

    const mergedHitRules = mergeRules(transactionInDb.hitRules, hitRules)

    const status = getAggregatedRuleStatus(hitRules)
    const finalStatus = this.isMoreSevereAction(status, oldStatus)
      ? status
      : oldStatus

    const newTransactionEvent: TransactionEvent = {
      transactionId: transaction.transactionId,
      timestamp: Date.now(),
      transactionState: transaction.transactionState || 'CREATED',
      eventId: uuidv4(),
      updatedTransactionAttributes: transaction,
      eventDescription: `Transaction event created as a result of asynchronous rule execution.`,
    }

    await Promise.all([
      this.transactionRepository.updateTransactionRulesResult(
        transaction.transactionId,
        {
          status: finalStatus,
          executedRules: mergedExecutedRules,
          hitRules: mergedHitRules,
        }
      ),
      this.transactionEventRepository.saveTransactionEvent(
        newTransactionEvent,
        {
          executedRules: executedRules,
          hitRules: hitRules,
          status: finalStatus,
        }
      ),
      sendTransactionAggregationTasks(
        aggregationMessages,
        this.dynamoDb,
        this.mongoDb
      ),
    ])
    if (finalStatus !== oldStatus) {
      await sendStatusChangeWebhook(
        this.tenantId,
        transaction.transactionId,
        finalStatus
      )
    }
  }

  public async verifyAsyncRulesTransactionEvent(
    updatedTransaction: Transaction,
    transactionEventId: string,
    senderUser?: User | Business,
    receiverUser?: User | Business
  ): Promise<void> {
    const transactionEvents =
      await this.transactionEventRepository.getTransactionEvents(
        updatedTransaction.transactionId
      )

    const transactionEventInDb = transactionEvents.find(
      (event) => event.eventId === transactionEventId
    )

    if (!transactionEventInDb) {
      throw new NotFound(
        `Transaction Event ${transactionEventId} not found when verifying async rules`
      )
    }
    const oldStatus = transactionEventInDb.status
    await this.verifyAsyncRulesTransactionInternal(
      updatedTransaction,
      transactionEvents,
      'UPDATE',
      senderUser,
      receiverUser,
      transactionEventInDb.riskScoreDetails,
      oldStatus
    )
  }

  public async reverifyTransaction(transaction: InternalTransaction) {
    const latestTransactionEvent =
      await this.getOrCreateInitialTransactionEvent(transaction)
    await this.reverifyTransactionInternal(transaction, [
      latestTransactionEvent,
    ])
  }

  private async reverifyTransactionInternal(
    transaction: InternalTransaction,
    transactionEvents: TransactionEvent[]
  ) {
    const data = await this.verifyTransactionInternal(
      transaction,
      transactionEvents,
      'INITIAL'
    )

    const {
      executedRules,
      hitRules,
      aggregationMessages,
      senderUser = null,
      receiverUser = null,
      isAnyAsyncRules,
    } = data
    const mergedExecutedRules = mergeRules(
      transaction.executedRules,
      executedRules
    )

    const mergedHitRules = mergeRules(transaction.hitRules, hitRules)

    const status = getAggregatedRuleStatus(mergedHitRules)

    const transactionEventsSorted = transactionEvents.sort(
      (a, b) => a.timestamp - b.timestamp
    )

    await Promise.all([
      this.transactionRepository.updateTransactionRulesResult(
        transaction.transactionId,
        { status, executedRules: mergedExecutedRules, hitRules: mergedHitRules }
      ),
      this.transactionEventRepository.updateTransactionEventRulesResult(
        transaction.transactionId,
        last(transactionEventsSorted) as TransactionEvent,
        { executedRules: mergedExecutedRules, hitRules: mergedHitRules, status }
      ),
      sendTransactionAggregationTasks(
        aggregationMessages,
        this.dynamoDb,
        this.mongoDb
      ),
      isAnyAsyncRules &&
        sendAsyncRuleTasks([
          {
            tenantId: this.tenantId,
            type: 'TRANSACTION',
            transaction: omit<Transaction>(
              { ...transaction, status: status } as Transaction,
              ['executedRules', 'hitRules']
            ) as Transaction,
            senderUser: omit<User>(senderUser, [
              'executedRules',
              'hitRules',
            ]) as User | Business,
            receiverUser: omit<User>(receiverUser, [
              'executedRules',
              'hitRules',
            ]) as User | Business,
          },
        ]),
    ])
  }

  public async verifyAsyncRulesTransaction(
    transaction: Transaction,
    senderUser?: User | Business,
    receiverUser?: User | Business,
    riskDetails?: TransactionRiskScoringResult
  ): Promise<void> {
    const initialTransactionEvent =
      await this.getOrCreateInitialTransactionEvent(transaction)
    await this.verifyAsyncRulesTransactionInternal(
      transaction,
      [initialTransactionEvent],
      'INITIAL',
      senderUser,
      receiverUser,
      riskDetails
    )
  }
  private getInitialTransactionEvent(
    transaction: Transaction
  ): TransactionEventWithRulesResult {
    const initialTransactionState = transaction.transactionState || 'CREATED'

    const initialTransactionEvent: TransactionEventWithRulesResult = {
      transactionId: transaction.transactionId,
      timestamp: transaction.timestamp,
      transactionState: initialTransactionState,
      updatedTransactionAttributes: transaction,
    }

    return initialTransactionEvent
  }

  private async verifyTransactionInternal(
    transaction: Transaction,
    transactionEvents: TransactionEventWithRulesResult[],
    stage: RuleStage,
    relatedData?: {
      transactionRiskDetails?: TransactionRiskScoringResult
      senderUser?: User | Business | undefined
      receiverUser?: User | Business | undefined
    },
    options?: ValidationOptions
  ): Promise<{
    executedRules: ExecutedRulesResult[]
    hitRules: HitRulesDetails[]
    aggregationMessages: FifoSqsMessage[]
    riskScoreDetails?: TransactionRiskScoringResult
    riskScoreComponents?: RiskScoreComponent[]
    senderUser: User | Business | undefined
    receiverUser: User | Business | undefined
    isAnyAsyncRules?: boolean
    userRiskScoreDetails?: {
      originUserCraRiskLevel?: RiskLevel
      destinationUserCraRiskLevel?: RiskLevel
      originUserCraRiskScore?: number
      destinationUserCraRiskScore?: number
    }
  }> {
    const getInitialDataSegment = await addNewSubsegment(
      'Rules Engine',
      'Get Initial Data'
    )

    const userPromise =
      relatedData &&
      ('senderUser' in relatedData || 'receiverUser' in relatedData)
        ? Promise.resolve(pick(relatedData, ['senderUser', 'receiverUser']))
        : this.getTransactionUsers(transaction, options)

    const [{ senderUser, receiverUser }] = await Promise.all([userPromise])

    const newRiskScoreDetails =
      relatedData && 'transactionRiskDetails' in relatedData
        ? (relatedData.transactionRiskDetails as RiskScoreDetails)
        : hasFeature('RISK_SCORING')
        ? await this.riskScoringV8Service.handleTransaction(
            transaction,
            transactionEvents,
            senderUser,
            receiverUser
          )
        : undefined

    const [
      { riskLevel: senderUserRiskLevel },
      activeRuleInstances,
      { riskLevel: receiverUserRiskLevel },
    ] = await Promise.all([
      this.getUserRiskLevelAndScore(transaction.originUserId),
      this.ruleInstanceRepository.getActiveRuleInstances(),
      this.getUserRiskLevelAndScore(transaction.destinationUserId),
    ])

    const toRunRule = (
      ruleInstance: RuleInstance,
      typeToRun: RuleInstance['type']
    ) => {
      if (ruleInstance.type !== typeToRun) {
        return false
      }

      const ruleMode = ruleInstance.mode as RuleMode

      if (
        (ruleMode?.includes('SYNC') ||
          ruleInstance.ruleExecutionMode === 'SYNC') &&
        relatedData
      ) {
        return false
      } else if (
        (ruleMode?.includes('ASYNC') ||
          ruleInstance.ruleExecutionMode === 'ASYNC') &&
        !relatedData
      ) {
        return false
      }

      return true
    }

    const transactionRuleInstances = activeRuleInstances.filter(
      (ruleInstance) => toRunRule(ruleInstance, 'TRANSACTION')
    )

    const userRuleInstances = activeRuleInstances.filter((v) =>
      toRunRule(v, 'USER')
    )

    const transactionWithRiskDetails: TransactionWithRiskDetails = {
      ...transaction,
      riskScoreDetails: newRiskScoreDetails,
    }

    const lastTransactionEvent = last(transactionEvents)

    const riskScoreDetailsData = newRiskScoreDetails
      ? pick(newRiskScoreDetails, ['trsScore', 'trsRiskLevel'])
      : undefined

    if (lastTransactionEvent) {
      lastTransactionEvent.riskScoreDetails = riskScoreDetailsData
    }

    const rulesById = await this.getRulesById(transactionRuleInstances)

    getInitialDataSegment?.close()

    const runRulesSegment = await addNewSubsegment('Rules Engine', 'Run Rules')
    logger.debug(`Running rules`)

    const [originalVerifyTransactionResults] = await Promise.all([
      Promise.all(
        transactionRuleInstances.map(async (ruleInstance) =>
          this.verifyTransactionRule({
            rule: ruleInstance.ruleId
              ? rulesById[ruleInstance.ruleId]
              : undefined,
            ruleInstance,
            senderUserRiskLevel,
            transaction: transactionWithRiskDetails,
            transactionEvents,
            senderUser,
            receiverUser,
            receiverUserRiskLevel,
            stage,
          })
        )
      ),
      // Update aggregation variables in V8 user rules
      Promise.all(
        userRuleInstances.map((ruleInstance) => {
          if (!runOnV8Engine(ruleInstance)) {
            return []
          }

          return this.ruleLogicEvaluator.handleV8Aggregation(
            'RULES',
            ruleInstance.logicAggregationVariables ?? [],
            transaction,
            transactionEvents
          )
        })
      ),
    ])
    const verifyTransactionResults = compact(originalVerifyTransactionResults)
    const aggregationMessages = verifyTransactionResults.flatMap((result) =>
      compact(result.aggregationMessages)
    )

    const ruleResults = compact(
      map(verifyTransactionResults, (result) => result.result)
    ) as ExecutedRulesResult[]

    runRulesSegment?.close()

    const executedAndHitRulesResult = getExecutedAndHitRulesResult(ruleResults)

    this.ruleLogicEvaluator.updatedAggregationVariables.clear()

    const userRiskScoreDetails = {
      originUserCraRiskLevel: newRiskScoreDetails?.originUserCraRiskLevel,
      destinationUserCraRiskLevel:
        newRiskScoreDetails?.destinationUserCraRiskLevel,
      originUserCraRiskScore: newRiskScoreDetails?.originUserCraRiskScore,
      destinationUserCraRiskScore:
        newRiskScoreDetails?.destinationUserCraRiskScore,
    }

    return {
      ...executedAndHitRulesResult,
      aggregationMessages,
      riskScoreDetails: riskScoreDetailsData,
      riskScoreComponents: (newRiskScoreDetails as RiskScoreDetails)
        ?.components,
      senderUser,
      receiverUser,
      isAnyAsyncRules: activeRuleInstances
        .filter((ruleInstance) => ruleInstance.type === 'TRANSACTION')
        .some(isAsyncRule),
      userRiskScoreDetails: userRiskScoreDetails,
    }
  }

  public async verifyRuleIdempotent(options: {
    rule?: Rule
    ruleInstance: RuleInstance
    senderUserRiskLevel?: RiskLevel
    receiverUserRiskLevel?: RiskLevel
    transaction?: Transaction
    transactionEvents?: TransactionEventWithRulesResult[]
    database: 'MONGODB' | 'DYNAMODB'
    senderUser?: User | Business
    receiverUser?: User | Business
    tracing?: boolean
    stage: RuleStage
  }): Promise<{
    ruleClassInstance: TransactionRuleBase | UserRuleBase | undefined
    isTransactionHistoricalFiltered: boolean
    result: ExecutedRulesResult
  }> {
    const {
      rule,
      ruleInstance,
      senderUserRiskLevel,
      receiverUserRiskLevel,
      transaction,
      transactionEvents,
      senderUser,
      receiverUser,
      database,
      tracing,
    } = options
    const { parameters, logic, action } = this.getUserSpecificParameters(
      ruleInstance.type === 'TRANSACTION' &&
        ruleInstance.ruleRunFor === 'RECEIVER'
        ? receiverUserRiskLevel
        : senderUserRiskLevel,
      ruleInstance
    )

    const ongoingScreeningMode = options.stage === 'ONGOING' ? true : undefined
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
    let vars: ExecutedLogicVars[] | undefined

    if (
      runOnV8Engine(ruleInstance) &&
      logic &&
      !isV2ScreeningRule(ruleInstance)
    ) {
      const data = transactionWithValidUserId
        ? ({
            type: 'TRANSACTION',
            transaction: transactionWithValidUserId,
            transactionEvents,
            senderUser,
            receiverUser,
          } as TransactionLogicData)
        : senderUser
        ? ({ type: 'USER', user: senderUser } as UserLogicData)
        : null
      if (data) {
        const {
          hit,
          hitDirections,
          vars: ruleVars,
        } = await this.ruleLogicEvaluator.evaluate(
          logic,
          {
            agg: ruleInstance.logicAggregationVariables,
            entity: ruleInstance.logicEntityVariables,
          },
          {
            baseCurrency: ruleInstance.baseCurrency,
            tenantId: this.tenantId,
          },
          data
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
      if (!rule) {
        throw new Error('Rule not found')
      }
      ruleClassInstance = transactionWithValidUserId
        ? new (RuleClass as typeof TransactionRuleBase)(
            this.tenantId,
            {
              transaction: transactionWithValidUserId,
              senderUser,
              receiverUser,
            },
            { parameters, filters: ruleFilters },
            { ruleInstance, rule: rule },
            {
              sanctionsService: this.sanctionsService,
              geoIpService: this.geoIpService,
            },
            mode,
            this.dynamoDb,
            mode === 'MONGODB' ? await getMongoDbClient() : undefined
          )
        : new (RuleClass as typeof UserRuleBase)(
            this.tenantId,
            { user: senderUser ?? ({} as User), stage: options.stage },
            { parameters, filters: ruleFilters },
            { ruleInstance, rule: rule },
            {
              sanctionsService: this.sanctionsService,
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
      )
        .filter(Boolean)
        .map((description) =>
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
        executedAt: Date.now(),
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
        isShadow: isShadowRule(ruleInstance),
      },
    }
  }

  private async verifyTransactionRule(options: {
    rule?: Rule
    ruleInstance: RuleInstance
    senderUserRiskLevel: RiskLevel | undefined
    receiverUserRiskLevel: RiskLevel | undefined
    transaction: TransactionWithRiskDetails
    transactionEvents: TransactionEventWithRulesResult[]
    senderUser?: User | Business
    receiverUser?: User | Business
    stage: RuleStage
  }): Promise<
    | {
        result?: ExecutedRulesResult | undefined
        aggregationMessages?: FifoSqsMessage[]
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
          logger.debug(`Running rule`)
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
          logger.debug(`Completed rule`)

          let aggregationMessages: FifoSqsMessage[] = []
          if (runOnV8Engine(ruleInstance)) {
            await this.ruleLogicEvaluator.handleV8Aggregation(
              'RULES',
              ruleInstance.logicAggregationVariables ?? [],
              options.transaction,
              options.transactionEvents
            )
          } else {
            aggregationMessages =
              ruleClassInstance instanceof TransactionAggregationRule
                ? await this.handleTransactionRuleAggregation(
                    ruleClassInstance,
                    isTransactionHistoricalFiltered,
                    options.transaction,
                    ruleInstance.id ?? ''
                  )
                : []
          }

          return {
            result,
            aggregationMessages,
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
  ): Promise<FifoSqsMessage[]> {
    if (!ruleClassInstance.shouldUseAggregation()) {
      return []
    }

    const directions = ['origin', 'destination'] as const
    const aggregationMessages: FifoSqsMessage[] = []
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
            aggregationMessages.push({
              MessageBody: JSON.stringify({
                direction,
                transactionId: transaction.transactionId,
                ruleInstanceId,
                tenantId: this.tenantId,
                isTransactionHistoricalFiltered,
              }),
              MessageGroupId: generateChecksum(userKeyId),
              MessageDeduplicationId: generateChecksum(
                `${userKeyId}:${ruleInstanceId}:${transaction.transactionId}`
              ),
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
    return aggregationMessages
  }

  private async verifyUserRule(options: {
    rule?: Rule
    ruleInstance: RuleInstance
    userRiskLevel: RiskLevel | undefined
    user: User | Business
    stage: RuleStage
  }) {
    return withContext(async () => {
      try {
        updateLogMetadata({
          ruleId: options.ruleInstance.ruleId,
          ruleInstanceId: options.ruleInstance.id,
          userId: options.user.userId,
        })
        logger.debug(`Running rule`)
        const startTime = Date.now()
        const { result } = await this.verifyRuleIdempotent({
          rule: options.rule,
          ruleInstance: options.ruleInstance,
          senderUser: options.user,
          senderUserRiskLevel: options.userRiskLevel,
          database: 'MONGODB',
          stage: options.stage,
        })
        const ruleExecutionTimeMs = Date.now().valueOf() - startTime.valueOf()
        // Don't await publishing metric
        publishMetric(RULE_EXECUTION_TIME_MS_METRIC, ruleExecutionTimeMs)
        logger.debug(`Completed rule`)
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

  private async getUserRiskLevelAndScore(userId: string | undefined): Promise<{
    riskLevel?: RiskLevel
    riskScore?: number
    isUpdatable?: boolean
  }> {
    if (!userId || !hasFeature('RISK_LEVELS')) {
      return {
        riskLevel: undefined,
        riskScore: undefined,
        isUpdatable: undefined,
      }
    }
    const riskItem = await this.riskRepository.getDRSRiskItem(userId)
    return {
      riskLevel: riskItem?.manualRiskLevel ?? riskItem?.derivedRiskLevel,
      riskScore: riskItem?.drsScore,
      isUpdatable: riskItem?.isUpdatable,
    }
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

  private async getTransactionUsers(
    transaction: Transaction,
    options?: ValidationOptions
  ): Promise<{
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

    const missingUsers = compact([
      options?.validateOriginUserId && transaction.originUserId && !senderUser
        ? `originUserId: ${transaction.originUserId}`
        : null,
      options?.validateDestinationUserId &&
      transaction.destinationUserId &&
      !receiverUser
        ? `destinationUserId: ${transaction.destinationUserId}`
        : null,
    ])
    if (missingUsers.length) {
      const errorMessage =
        missingUsers.length === 1
          ? `${missingUsers[0]} does not exist`
          : `${missingUsers[0]} and ${missingUsers[1]} do not exist`
      throw new BadRequest(errorMessage)
    }

    return {
      senderUser,
      receiverUser,
    }
  }

  private async updateGlobalAggregation(
    transaction: Transaction,
    previousTransactionEvents: TransactionEvent[]
  ) {
    if (hasFeature('PNB')) {
      return
    }

    const updateAggregationsSegment = await addNewSubsegment(
      'Rules Engine',
      'Update Global Aggregations'
    )
    logger.debug(`Updating global aggregations`)

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
    logger.debug(`Updated global aggregations`)
    updateAggregationsSegment?.close()
  }

  public async applyTransactionAction(
    data: TransactionAction,
    userId: string
  ): Promise<void> {
    const { transactionIds, action, reason, comment } = data
    const txns = await this.transactionRepository.getTransactionsByIds(
      transactionIds
    )

    const account = await this.accountsService.getAccount(userId)

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

    const promises = [
      this.transactionEventRepository.saveTransactionEvents(
        txns
          .filter(
            (transaction): transaction is NonNullable<typeof transaction> =>
              !!transaction
          )
          .map((transaction) => ({
            transactionEvent: {
              transactionState:
                transaction.transactionState as TransactionState,
              timestamp: Date.now(),
              transactionId: transaction.transactionId,
              eventDescription: `Transaction status was manually changed to ${action} by ${
                account?.name ?? userId
              }`,
              reason: reason.join(', '),
              riskScoreDetails: transaction.riskScoreDetails,
            },
            rulesResult: {
              status: action,
              hitRules: transaction.hitRules,
              executedRules: transaction.executedRules,
            },
          }))
      ),
      this.transactionRepository.saveTransactions(
        txns
          .filter(
            (transaction): transaction is NonNullable<typeof transaction> =>
              !!transaction
          )
          .map((transaction) => ({
            transaction,
            rulesResult: {
              status: action,
              hitRules: transaction.hitRules,
              executedRules: transaction.executedRules,
            },
          }))
      ),
    ]

    await Promise.all(promises)

    const webhooksData: ThinWebhookDeliveryTask<TransactionStatusDetails>[] =
      txns.map((txn) => ({
        event: 'TRANSACTION_STATUS_UPDATED',
        triggeredBy: 'MANUAL',
        entityId: txn?.transactionId as string,
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

  private async getOrCreateInitialTransactionEvent(
    transaction: Transaction
  ): Promise<TransactionEventWithRulesResult> {
    const lastEvent =
      await this.transactionEventRepository.getLastTransactionEvent(
        transaction.transactionId
      )

    if (lastEvent) {
      return lastEvent
    }

    return {
      ...this.getInitialTransactionEvent(transaction),
      eventId: uuidv4(),
    }
  }
}

const sendStatusChangeWebhook = async (
  tenantId: string,
  transactionId: string,
  newStatus: string | undefined
) => {
  const webhookTask: ThinWebhookDeliveryTask = {
    event: 'TRANSACTION_STATUS_UPDATED',
    entityId: transactionId,
    triggeredBy: 'SYSTEM',
    payload: {
      transactionId,
      status: newStatus,
      reasons: 'Status updated by async rule',
    },
  }
  await sendWebhookTasks(tenantId, [webhookTask])
}
