import { AsyncLogicEngine } from 'json-logic-engine'
import memoizeOne from 'memoize-one'
import DataLoader from 'dataloader'
import {
  compact,
  drop,
  groupBy,
  isEmpty,
  isEqual,
  last,
  mapValues,
  memoize,
  mergeWith,
  minBy,
  omit,
  omitBy,
  sortBy,
  uniq,
} from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { RULE_FUNCTIONS } from '../v8-functions'
import { getRuleVariableByKey, isSenderUserVariable } from '../v8-variables'
import { getTimeRangeByTimeWindows } from '../utils/time-utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import {
  getRuleVariableAggregator,
  mergeGroups,
  mergeValues,
} from '../v8-variable-aggregators'
import {
  TransactionAggregationTaskEntry,
  V8RuleAggregationRebuildTask,
  V8TransactionAggregationTask,
} from '../rules-engine-service'
import {
  getTransactionsGenerator,
  getTransactionStatsTimeGroupLabel,
  groupTransactionsByGranularity,
  hydrateTransactionEvents,
} from '../utils/transaction-rule-utils'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import {
  BusinessUserRuleVariable,
  CommonUserRuleVariable,
  ConsumerUserRuleVariable,
  RuleVariableContext,
  TransactionEventRuleVariable,
  TransactionRuleVariable,
} from '../v8-variables/types'
import { getPaymentDetailsIdentifiersKey } from '../v8-variables/payment-details'
import {
  AuxiliaryIndexTransaction,
  TransactionWithRiskDetails,
} from '../repositories/transaction-repository-interface'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
import { CUSTOM_BUILT_IN_RULE_OPERATORS } from '../v8-operators/custom-built-in-operators'
import { RULE_OPERATORS } from '../v8-operators'
import { TransactionEventRepository } from '../repositories/transaction-event-repository'
import {
  AggregationData,
  AggregationRepository,
  getAggVarHash,
} from './aggregation-repository'
import {
  canAggregate,
  getAggregationGranularity,
  getVariableKeysFromLogic,
  transformJsonLogic,
  transformJsonLogicVars,
  userFiltersData,
} from './utils'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { generateChecksum } from '@/utils/object'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { logger } from '@/core/logger'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { RuleAggregationType } from '@/@types/openapi-internal/RuleAggregationType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ExecutedRuleVars } from '@/@types/openapi-internal/ExecutedRuleVars'
import { RuleEntityVariableInUse } from '@/@types/openapi-internal/RuleEntityVariableInUse'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { RuleEntityVariableEntityEnum } from '@/@types/openapi-internal/RuleEntityVariable'
import { getContext, hasFeature } from '@/core/utils/context'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { batchWrite, BatchWriteRequestInternal } from '@/utils/dynamodb'
import { FifoSqsMessage } from '@/utils/sns-sqs-client'
import { addNewSubsegment } from '@/core/xray'

export type TransactionRuleData = {
  type: 'TRANSACTION'
  transaction: TransactionWithRiskDetails
  transactionEvents: TransactionEventWithRulesResult[]
  senderUser?: User | Business
  receiverUser?: User | Business
}

export type UserRuleData = {
  type: 'USER'
  user: User | Business
}
export type RuleData = TransactionRuleData | UserRuleData
type UserIdentifier = {
  userId?: string
  paymentDetails?: PaymentDetails
}

export type AuxiliaryIndexTransactionWithDirection =
  AuxiliaryIndexTransaction & {
    direction?: 'origin' | 'destination'
  }
const TRANSACTION_EVENT_ENTITY_VARIABLE_TYPE: RuleEntityVariableEntityEnum =
  'TRANSACTION_EVENT'

export function getAggregationTaskMessage(
  task: TransactionAggregationTaskEntry
): FifoSqsMessage {
  const payload = task.payload as
    | V8TransactionAggregationTask
    | V8RuleAggregationRebuildTask
  const deduplicationId = generateChecksum(
    `${task.userKeyId}:${getAggVarHash(payload.aggregationVariable)}:${
      payload.type === 'TRANSACTION_AGGREGATION'
        ? payload.transaction.transactionId
        : ''
    }`
  )
  return {
    MessageBody: JSON.stringify(payload),
    MessageGroupId: generateChecksum(task.userKeyId),
    MessageDeduplicationId: deduplicationId,
  }
}

export const getJsonLogicEngine = memoizeOne(
  (context?: { tenantId: string; dynamoDb: DynamoDBDocumentClient }) => {
    const jsonLogicEngine = new AsyncLogicEngine()
    RULE_FUNCTIONS.filter((v) => v.run).forEach((v) =>
      jsonLogicEngine.addMethod(v.key, v.run)
    )
    CUSTOM_BUILT_IN_RULE_OPERATORS.concat(RULE_OPERATORS).forEach((v) =>
      jsonLogicEngine.addMethod(
        v.key,
        memoize(
          (values) => {
            const cardinality = v.uiDefinition.cardinality ?? 1
            const lhs = values[0]
            const rhs = values.slice(1, cardinality + 1)
            const parameters = values[cardinality + 1]
            return v.run(
              lhs,
              rhs.length === 1 ? rhs[0] : rhs,
              parameters,
              context
            )
          },
          (v) => generateChecksum(v)
        )
      )
    )
    return jsonLogicEngine
  },
  isEqual
)

function getEntityVariableLoaderKey(
  entityVariable: RuleEntityVariableInUse
): Omit<RuleEntityVariableInUse, 'name'> {
  const { filtersLogic } = entityVariable
  return {
    key: entityVariable.key,
    entityKey: entityVariable.entityKey,
    filtersLogic: isEmpty(filtersLogic) ? undefined : filtersLogic,
  }
}

type Mode = 'MONGODB' | 'DYNAMODB'
export class RuleJsonLogicEvaluator {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private aggregationRepository: AggregationRepository
  private mode: Mode
  private transactionEventRepository?: TransactionEventRepository

  constructor(
    tenantId: string,
    dynamoDb: DynamoDBDocumentClient,
    mode: Mode = 'DYNAMODB'
  ) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
    this.mode = mode
  }

  private async initialize() {
    if (this.transactionEventRepository) {
      return
    }
    this.transactionEventRepository = new TransactionEventRepository(
      this.tenantId,
      { dynamoDb: this.dynamoDb, mongoDb: await getMongoDbClient() }
    )
  }

  public setMode(mode: Mode) {
    this.mode = mode
  }

  public async evaluate(
    rawJsonLogic: object,
    variables: {
      agg?: RuleAggregationVariable[]
      entity?: RuleEntityVariableInUse[]
    },
    context: Omit<RuleVariableContext, 'dynamoDb'>,
    data: RuleData
  ): Promise<{
    hit: boolean
    hitDirections: RuleHitDirection[]
    vars: ExecutedRuleVars[]
  }> {
    const traceNamespace = `${getContext()?.metricDimensions?.ruleInstanceId}`
    const v8SubSegment = await addNewSubsegment(
      traceNamespace,
      'Rule Evaluation'
    )
    const entityVarDataloader = this.entityVarLoader(data, {
      ...context,
      dynamoDb: this.dynamoDb,
    })
    const jsonLogic = transformJsonLogic(rawJsonLogic, variables.entity ?? [])
    const { entityVariableKeys, aggVariableKeys } =
      getVariableKeysFromLogic(jsonLogic)
    const entityVariableSubSegment = await addNewSubsegment(
      traceNamespace,
      'Entity Variable Data'
    )
    const entityVarEntries = await Promise.all(
      entityVariableKeys.map(async (key) => {
        const variable = variables.entity?.find((v) => v.key === key) ?? {
          key: key,
          entityKey: key,
        }
        return [
          key,
          await entityVarDataloader.load(getEntityVariableLoaderKey(variable)),
        ]
      })
    )
    entityVariableSubSegment?.close()
    const aggVariables = aggVariableKeys
      .map((key) => {
        const aggVariable = variables.agg?.find((v) => v.key === key)
        if (!aggVariable) {
          logger.error(`Aggregation variable ${key} not found`)
          return
        }
        return aggVariable
      })
      .filter(Boolean) as RuleAggregationVariable[]
    const aggHasBothUserDirections = aggVariables.some(
      (v) => !v.userDirection || v.userDirection === 'SENDER_OR_RECEIVER'
    )
    const aggVarDataSubSegment = await addNewSubsegment(
      traceNamespace,
      'Aggregation Variable Data'
    )
    const aggVarData = await Promise.all(
      aggVariables.map(async (aggVariable) => {
        const aggregationVarLoader = this.aggregationVarLoader(data)
        return {
          variable: aggVariable,
          ORIGIN:
            aggVariable.userDirection !== 'RECEIVER'
              ? await aggregationVarLoader.load({
                  direction: 'origin',
                  aggVariable,
                })
              : null,
          DESTINATION:
            aggVariable.userDirection !== 'SENDER'
              ? await aggregationVarLoader.load({
                  direction: 'destination',
                  aggVariable,
                })
              : null,
        }
      })
    )
    aggVarDataSubSegment?.close()
    // NOTE: If an aggregation variable has both user directions, we need to evaluate the logic
    // twice, one for each direction
    const directions: RuleHitDirection[] = aggHasBothUserDirections
      ? ['ORIGIN', 'DESTINATION']
      : ['ORIGIN']
    let hit = false
    // NOTE: If there's no aggregation variable, we hit both directions. One side can be muted
    // by setting alertConfig.alertCreationDirection
    const hitDirections: RuleHitDirection[] =
      aggVariables.length > 0 ? [] : ['ORIGIN', 'DESTINATION']
    const vars: ExecutedRuleVars[] = []
    for (const direction of directions) {
      const aggVarEntries: Array<{
        entry: [string, any]
        direction: RuleHitDirection
      }> = aggVarData.map((v) => {
        const directionToUse: RuleHitDirection =
          v.variable.userDirection === 'SENDER'
            ? 'ORIGIN'
            : v.variable.userDirection === 'RECEIVER'
            ? 'DESTINATION'
            : direction
        return {
          entry: [v.variable.key, v[directionToUse]],
          direction: directionToUse,
        }
      })
      const varData = Object.fromEntries(
        entityVarEntries.concat(aggVarEntries.map((v) => v.entry))
      )

      let varValue: { [key: string]: unknown } = {}

      try {
        varValue = transformJsonLogicVars(jsonLogic, varData)
      } catch (e) {
        logger.error(
          `Failed to transform json logic vars: ${(e as Error).message}`
        )
      }
      vars.push({
        direction,
        value: varValue,
      })

      const jsonLogicEngine = getJsonLogicEngine({
        tenantId: this.tenantId,
        dynamoDb: this.dynamoDb,
      })
      const resultHit = await jsonLogicEngine.run(jsonLogic, varData)
      if (resultHit) {
        hitDirections.push(...uniq(aggVarEntries.map((v) => v.direction)))
      }
      if (!hit) {
        hit = resultHit
      }
    }
    const finalHitDirections: RuleHitDirection[] =
      data.type === 'TRANSACTION' ? uniq(hitDirections) : ['ORIGIN']

    v8SubSegment?.close()
    return {
      hit,
      hitDirections: hit ? finalHitDirections : [],
      vars,
    }
  }

  private async findTransactionEvent(
    transactionEvents: TransactionEventWithRulesResult[],
    logic: any,
    context: RuleVariableContext
  ): Promise<
    | {
        transactionEvent: TransactionEventWithRulesResult
        transaction: TransactionWithRiskDetails
      }
    | undefined
  > {
    const txEvents = hydrateTransactionEvents(transactionEvents)
    for (const txEvent of txEvents.slice().reverse()) {
      const result = await this.evaluate(logic, {}, context, {
        type: 'TRANSACTION',
        transaction: txEvent.transaction,
        transactionEvents: [txEvent.transactionEvent],
      })
      if (result.hit) {
        return {
          transaction: txEvent.transaction,
          transactionEvent: txEvent.transactionEvent,
        }
      }
    }
  }

  private entityVarLoader = memoizeOne(
    (data: RuleData, context: RuleVariableContext) => {
      return new DataLoader<Omit<RuleEntityVariableInUse, 'name'>, any, string>(
        async (entityVariables) => {
          return Promise.all(
            entityVariables.map(async (entityVariable) => {
              const variable = getRuleVariableByKey(
                entityVariable.entityKey ?? entityVariable.key
              )
              if (!variable) {
                logger.error(
                  `Rule variable not found: ${entityVariable.entityKey}`
                )
                return null
              }
              if (
                variable.entity === 'TRANSACTION' &&
                data.type === 'TRANSACTION'
              ) {
                let transaction: Transaction | undefined = data.transaction
                if (!isEmpty(entityVariable.filtersLogic)) {
                  const targetTransactionEvent =
                    await this.findTransactionEvent(
                      data.transactionEvents ?? [],
                      entityVariable.filtersLogic,
                      context
                    )
                  transaction = targetTransactionEvent
                    ? targetTransactionEvent.transaction
                    : undefined
                }
                if (!transaction) {
                  return null
                }
                return (variable as TransactionRuleVariable<any>).load(
                  transaction,
                  context
                )
              }
              if (
                variable.entity === 'TRANSACTION_EVENT' &&
                data.type === 'TRANSACTION'
              ) {
                let transactionEvent: TransactionEvent | undefined = last(
                  data.transactionEvents
                )
                if (!isEmpty(entityVariable.filtersLogic)) {
                  const targetTransactionEvent =
                    await this.findTransactionEvent(
                      data.transactionEvents ?? [],
                      entityVariable.filtersLogic,
                      context
                    )
                  transactionEvent = targetTransactionEvent?.transactionEvent
                }
                if (!transactionEvent) {
                  return null
                }
                return (variable as TransactionEventRuleVariable<any>).load(
                  transactionEvent,
                  context
                )
              }

              const user =
                data.type === 'TRANSACTION'
                  ? isSenderUserVariable(variable.key)
                    ? data.senderUser
                    : data.receiverUser
                  : data.user

              if (!user) {
                return null
              }
              if (variable.entity === 'CONSUMER_USER') {
                return (variable as ConsumerUserRuleVariable<any>).load(
                  user as User,
                  context
                )
              }
              if (variable.entity === 'BUSINESS_USER') {
                return (variable as BusinessUserRuleVariable<any>).load(
                  user as Business,
                  context
                )
              }
              if (variable.entity === 'USER') {
                return (variable as CommonUserRuleVariable<any>).load(
                  user,
                  context
                )
              }
              return null
            })
          )
        },
        { cacheKeyFn: generateChecksum }
      )
    },
    // Don't take dynamoDb into account
    ([data1, context1], [data2, context2]) => {
      return isEqual(
        [data1, omit(context1, 'dynamoDb')],
        [data2, omit(context2, 'dynamoDb')]
      )
    }
  )

  private aggregationVarLoader = memoizeOne(
    (data: RuleData) => {
      return new DataLoader(
        async (
          variableKeys: readonly {
            direction: 'origin' | 'destination'
            aggVariable: RuleAggregationVariable
          }[]
        ) => {
          return Promise.all(
            variableKeys.map(async ({ direction, aggVariable }) => {
              return this.loadAggregationData(direction, aggVariable, data)
            })
          )
        },
        {
          cacheKeyFn: ({ direction, aggVariable }) => {
            return `${direction}-${getAggVarHash(aggVariable)}`
          },
        }
      )
    },
    (a, b) => isEqual(a[0], b[0])
  )

  private isTransactionApplied = memoize(
    async (
      aggregationVariable: RuleAggregationVariable,
      direction: 'origin' | 'destination',
      transactionId: string
    ): Promise<boolean> => {
      if (this.mode !== 'DYNAMODB') {
        return false
      }
      return await this.aggregationRepository.isTransactionApplied(
        aggregationVariable,
        direction,
        transactionId
      )
    },
    (aggregationVariable, direction, transactionId) =>
      `${getAggVarHash(aggregationVariable)}-${direction}-${transactionId}`
  )

  private userLoader = memoize(
    async (
      userId: string | undefined
    ): Promise<User | Business | undefined> => {
      if (!userId) {
        return undefined
      }
      const userRepository = new UserRepository(this.tenantId, {
        dynamoDb: this.dynamoDb,
      })
      return await userRepository.getUser(userId)
    },
    (userId: string | undefined) => userId ?? ''
  )

  private getUserKeyId(
    transaction: Transaction,
    direction: 'origin' | 'destination',
    type: RuleAggregationType
  ): string | undefined {
    switch (type) {
      case 'USER_TRANSACTIONS':
        return direction === 'origin'
          ? transaction.originUserId
          : transaction.destinationUserId
      case 'PAYMENT_DETAILS_TRANSACTIONS': {
        const paymentDetails =
          direction === 'origin'
            ? transaction.originPaymentDetails
            : transaction.destinationPaymentDetails
        if (paymentDetails) {
          return getPaymentDetailsIdentifiersKey(paymentDetails)
        }
      }
    }
  }

  /**
   * Aggregation related
   */

  public async rebuildOrUpdateAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    data: TransactionRuleData,
    direction: 'origin' | 'destination'
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }
    const { transaction } = data

    const userKeyId = this.getUserKeyId(
      transaction,
      direction,
      aggregationVariable.type
    )
    if (!userKeyId) {
      return
    }
    await this.rebuildAggregationVariable(
      aggregationVariable,
      transaction.timestamp,
      direction === 'origin'
        ? transaction.originUserId
        : transaction.destinationUserId,
      direction === 'origin'
        ? transaction.originPaymentDetails
        : transaction.destinationPaymentDetails
    )

    await this.updateAggregationVariableInternal(
      aggregationVariable,
      data,
      direction,
      userKeyId
    )
  }

  public async rebuildAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    currentTimestamp: number,
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined
  ) {
    const userKeyId =
      aggregationVariable.type === 'USER_TRANSACTIONS'
        ? userId
        : paymentDetails && getPaymentDetailsIdentifiersKey(paymentDetails)

    if (this.mode !== 'DYNAMODB' || !userKeyId) {
      return
    }

    const ready = await this.aggregationRepository.isAggregationVariableReady(
      aggregationVariable,
      userKeyId
    )
    if (ready) {
      return
    }

    logger.info('Rebuilding aggregation...')
    const { afterTimestamp, beforeTimestamp } = getTimeRangeByTimeWindows(
      currentTimestamp,
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )
    const aggregationResult = await this.getRebuiltAggregationVariableResult(
      aggregationVariable,
      {
        userId,
        paymentDetails,
      },
      {
        afterTimestamp,
        beforeTimestamp,
      }
    )
    logger.info('Prepared rebuild result')
    if (aggregationVariable.aggregationGroupByFieldKey) {
      const groups = uniq(
        Object.values(aggregationResult).flatMap((v) =>
          Object.keys(v.value as { [group: string]: unknown })
        )
      )
      const writeRequests: BatchWriteRequestInternal[] = []
      for (const group of groups) {
        const groupAggregationResult = omitBy(
          mapValues(aggregationResult, (v) => ({
            value: (
              v.value as { [group: string]: { value: unknown; entities } }
            )[group]?.value,
            entities: aggregationVariable.lastNEntities
              ? (v.value as { [group: string]: { value: unknown; entities } })[
                  group
                ]?.entities
              : undefined,
          })),
          (v) => !v.value
        )
        const groupWriteRequests =
          this.aggregationRepository.getUserTimeAggregationsRebuildWriteRequests(
            userKeyId,
            aggregationVariable,
            groupAggregationResult,
            group
          )
        writeRequests.push(...groupWriteRequests)
      }
      logger.info(`Saving aggregation for ${groups.length} groups`)
      await batchWrite(
        this.dynamoDb,
        writeRequests,
        StackConstants.TARPON_DYNAMODB_TABLE_NAME
      )
    } else {
      await this.aggregationRepository.rebuildUserTimeAggregations(
        userKeyId,
        aggregationVariable,
        aggregationResult,
        undefined
      )
    }
    await this.aggregationRepository.setAggregationVariableReady(
      aggregationVariable,
      userKeyId
    )
    logger.info('Rebuilt aggregation')
  }

  private async getRebuiltAggregationVariableResult(
    aggregationVariable: RuleAggregationVariable,
    userIdentifier: UserIdentifier,
    timeRange: { afterTimestamp: number; beforeTimestamp: number }
  ): Promise<{ [time: string]: AggregationData }> {
    const aggregator = getRuleVariableAggregator(
      aggregationVariable.aggregationFunc
    )

    const aggregationGranularity = getAggregationGranularity(
      aggregationVariable.timeWindow,
      this.tenantId
    )
    const userFilterDirections = userFiltersData(aggregationVariable)
    const fieldsToFetch = this.getTransactionFieldsToFetch(
      aggregationVariable,
      userFilterDirections
    )
    const transactionRepository =
      this.mode === 'DYNAMODB'
        ? new DynamoDbTransactionRepository(this.tenantId, this.dynamoDb)
        : new MongoDbTransactionRepository(
            this.tenantId,
            await getMongoDbClient()
          )
    const generator = getTransactionsGenerator(
      userIdentifier.userId,
      userIdentifier.paymentDetails,
      transactionRepository,
      {
        afterTimestamp: timeRange.afterTimestamp,
        beforeTimestamp: timeRange.beforeTimestamp,
        checkType:
          aggregationVariable.transactionDirection === 'SENDING'
            ? 'sending'
            : aggregationVariable.transactionDirection === 'RECEIVING'
            ? 'receiving'
            : 'all',
        matchPaymentMethodDetails:
          aggregationVariable.type === 'PAYMENT_DETAILS_TRANSACTIONS',
        filters: {},
      },
      fieldsToFetch as Array<keyof Transaction>
    )

    // NOTE: As we're still using lambda to rebuild aggregation, there's a hard 15 minuites timeout.
    // As we support 'all time' time window, it's possible that it takes more than 15 minutes to rebuild as
    // we need to fetch all the transaction of a user.
    // For now, as a workaround, we stop fetching transactions if the timeout is reached to avoid repeatedly
    // retrying to rebuild and fail.
    // TODO: Proper fix by FR-5225
    let timeoutReached = false
    const timeout = setTimeout(() => {
      timeoutReached = true
    }, 10 * 60 * 1000)
    let timeAggregatedResult: {
      [time: string]: AggregationData
    } = {}
    let targetTransactionsCount = 0
    const entitiesByGroupValue: { [key: string]: number } = {}
    for await (const data of generator) {
      const transactions: AuxiliaryIndexTransactionWithDirection[] = [
        ...data.sendingTransactions.map((tx) => ({
          ...tx,
          direction: 'origin' as const,
        })),
        ...data.receivingTransactions.map((tx) => ({
          ...tx,
          direction: 'destination' as const,
        })),
      ].sort((a, b) => (b.timestamp as number) - (a.timestamp as number))

      // Filter transactions by filtersLogic
      const targetTransactions: AuxiliaryIndexTransactionWithDirection[] = []
      for (const transaction of transactions) {
        const senderUser = userFilterDirections.has('sender')
          ? await this.userLoader(transaction.originUserId)
          : undefined
        const receiverUser = userFilterDirections.has('receiver')
          ? await this.userLoader(transaction.destinationUserId)
          : undefined

        const isTransactionFiltered =
          await this.isDataIncludedInAggregationVariable(aggregationVariable, {
            type: 'TRANSACTION',
            transaction: transaction as TransactionWithRiskDetails,
            transactionEvents: [],
            senderUser,
            receiverUser,
          })
        if (isTransactionFiltered) {
          targetTransactionsCount++
          targetTransactions.push(transaction)
          if (
            !aggregationVariable.aggregationGroupByFieldKey &&
            aggregationVariable.lastNEntities &&
            targetTransactionsCount === aggregationVariable.lastNEntities
          ) {
            break
          }
        }
      }
      // Update aggregation result
      const sendingTxEntityVariable = getRuleVariableByKey(
        this.getAggregationVarFieldKey(aggregationVariable, 'origin')
      ) as TransactionRuleVariable
      const receivingTxEntityVariable = getRuleVariableByKey(
        this.getAggregationVarFieldKey(aggregationVariable, 'destination')
      ) as TransactionRuleVariable
      const txGroupByEntityVariable =
        aggregationVariable.aggregationGroupByFieldKey
          ? (getRuleVariableByKey(
              aggregationVariable.aggregationGroupByFieldKey
            ) as TransactionRuleVariable)
          : undefined
      const context: RuleVariableContext = {
        baseCurrency: aggregationVariable.baseCurrency,
        dynamoDb: this.dynamoDb,
        tenantId: this.tenantId,
      }
      const hasGroups = Boolean(txGroupByEntityVariable)
      const partialTimeAggregatedResult = await groupTransactionsByGranularity(
        targetTransactions,
        async (groupTransactions) => {
          const aggregateValues = await Promise.all(
            groupTransactions.map(
              async (transaction: AuxiliaryIndexTransactionWithDirection) => {
                // TODO: support tx event for aggregation variable
                const entityVariable =
                  transaction.direction === 'origin'
                    ? sendingTxEntityVariable
                    : receivingTxEntityVariable
                const value = await entityVariable?.load(transaction, context)
                const groupValue =
                  hasGroups && txGroupByEntityVariable
                    ? await txGroupByEntityVariable.load(transaction, context)
                    : undefined

                return {
                  value,
                  groupValue: {
                    value: groupValue,
                    entity: {
                      timestamp: transaction.timestamp,
                      value,
                    },
                  },
                  ...(!hasGroups
                    ? {
                        entity: {
                          timestamp: transaction.timestamp,
                          value,
                        },
                      }
                    : {}),
                }
              }
            )
          )
          let filteredAggregateValues = [...aggregateValues]

          if (hasGroups) {
            filteredAggregateValues.sort(
              (a, b) =>
                (b.groupValue.entity.timestamp as number) -
                (a.groupValue.entity.timestamp as number)
            )
          }

          filteredAggregateValues = filteredAggregateValues.filter((v) => {
            if (!hasGroups) {
              return v.value
            }
            if (aggregationVariable.lastNEntities && v?.groupValue?.value) {
              const val = v.groupValue.value as string
              entitiesByGroupValue[val] = (entitiesByGroupValue[val] ?? 0) + 1
              return (
                v.value &&
                v.groupValue &&
                entitiesByGroupValue[val] <= aggregationVariable.lastNEntities
              )
            }
            return v.value && v.groupValue
          })
          const values = filteredAggregateValues.map((v) => v.value)
          const entities = filteredAggregateValues.map((v) => v.entity)
          return {
            value: hasGroups
              ? mapValues(
                  groupBy(filteredAggregateValues, (v) => v.groupValue.value),
                  (groupValues) => {
                    return {
                      value: aggregator.aggregate(
                        groupValues.map((v) => v.value)
                      ),
                      entities: groupValues.map((v) => v.groupValue.entity),
                    }
                  }
                )
              : aggregator.aggregate(values),
            ...(aggregationVariable.lastNEntities && !hasGroups
              ? { entities }
              : {}),
          }
        },
        aggregationGranularity
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        (a: AggregationData | undefined, b: AggregationData | undefined) => {
          return {
            value: hasGroups
              ? mergeGroups(
                  aggregator,
                  a?.value as { [key: string]: unknown },
                  b?.value as { [key: string]: unknown }
                )
              : mergeValues(aggregator, a?.value, b?.value),
            ...(aggregationVariable.lastNEntities && !hasGroups
              ? {
                  entities: (a?.entities ?? []).concat(b?.entities ?? []),
                }
              : {}),
          }
        }
      )
      if (
        !hasGroups &&
        aggregationVariable.lastNEntities &&
        targetTransactionsCount === aggregationVariable.lastNEntities
      ) {
        break
      }
      if (hasGroups && aggregationVariable.lastNEntities) {
        const flag = Object.entries(entitiesByGroupValue).every(
          ([_key, value]) => value >= (aggregationVariable.lastNEntities ?? 0)
        )
        if (flag) {
          break
        }
      }
      if (timeoutReached) {
        logger.error('Timeout reached while rebuilding aggregation (FR-5225)')
        break
      }
    }
    clearTimeout(timeout)
    return timeAggregatedResult
  }

  public async updateAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    data: TransactionRuleData,
    direction: 'origin' | 'destination'
  ) {
    if (
      this.mode !== 'DYNAMODB' ||
      !canAggregate(aggregationVariable.timeWindow)
    ) {
      return
    }
    const { transaction } = data

    const userKeyId = this.getUserKeyId(
      transaction,
      direction,
      aggregationVariable.type
    )
    if (!userKeyId) {
      return
    }

    const ready = await this.aggregationRepository.isAggregationVariableReady(
      aggregationVariable,
      userKeyId
    )
    if (!ready) {
      const task: TransactionAggregationTaskEntry = {
        userKeyId,
        payload: {
          type: 'TRANSACTION_AGGREGATION',
          aggregationVariable,
          transaction,
          direction,
          tenantId: this.tenantId,
        },
      }
      return getAggregationTaskMessage(task)
    }
    await this.updateAggregationVariableInternal(
      aggregationVariable,
      data,
      direction,
      userKeyId
    )
  }

  private async updateAggregationVariableInternal(
    aggregationVariable: RuleAggregationVariable,
    data: TransactionRuleData,
    direction: 'origin' | 'destination',
    userKeyId: string
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }
    const { transaction } = data

    logger.info('Updating aggregation...')
    const isNewDataFiltered = await this.isDataIncludedInAggregationVariable(
      aggregationVariable,
      data
    )
    const entityVarDataloader = this.entityVarLoader(data, {
      baseCurrency: aggregationVariable.baseCurrency,
      tenantId: this.tenantId,
      dynamoDb: this.dynamoDb,
    })
    const aggFieldKey = this.getAggregationVarFieldKey(
      aggregationVariable,
      direction
    )
    const newDataValue = await entityVarDataloader.load(
      getEntityVariableLoaderKey({
        key: aggFieldKey,
        entityKey: aggFieldKey,
      })
    )

    const hasGroups = Boolean(aggregationVariable.aggregationGroupByFieldKey)
    const newGroupValue = aggregationVariable.aggregationGroupByFieldKey
      ? await entityVarDataloader.load({
          key: aggregationVariable.aggregationGroupByFieldKey,
          entityKey: aggregationVariable.aggregationGroupByFieldKey,
        })
      : undefined
    if (!isNewDataFiltered || !newDataValue || (hasGroups && !newGroupValue)) {
      return
    }
    const shouldSkipUpdateAggregation = await this.isTransactionApplied(
      aggregationVariable,
      direction,
      transaction.transactionId
    )
    if (shouldSkipUpdateAggregation) {
      logger.warn('Skip updating aggregations.')
      return
    }

    const aggregator = getRuleVariableAggregator(
      aggregationVariable.aggregationFunc
    )

    const aggregationGranularity = getAggregationGranularity(
      aggregationVariable.timeWindow,
      this.tenantId
    )
    let updatedAggregationData:
      | ({
          time: string
        } & AggregationData)
      | null = null

    const targetAggregations =
      (await this.aggregationRepository.getUserRuleTimeAggregations(
        userKeyId,
        aggregationVariable,
        transaction.timestamp,
        transaction.timestamp + 1,
        aggregationGranularity,
        newGroupValue
      )) ?? []
    if ((targetAggregations?.length ?? 0) > 1) {
      throw new Error('Should only get one target aggregation')
    }
    let targetAggregation = targetAggregations?.[0] ?? {
      time: getTransactionStatsTimeGroupLabel(
        transaction.timestamp,
        aggregationGranularity
      ),
      value: aggregator.init(),
    }
    if (aggregationVariable.lastNEntities) {
      const aggregations =
        await this.aggregationRepository.getUserRuleTimeAggregations(
          userKeyId,
          aggregationVariable,
          0,
          transaction.timestamp + 1,
          aggregationGranularity,
          newGroupValue
        )
      const entitiesCountInAggregation =
        aggregations?.reduce(
          (acc, curr) => (curr?.entities ?? []).length + acc,
          1
        ) ?? 1
      if (entitiesCountInAggregation > aggregationVariable.lastNEntities) {
        const targetAggregationToUpdate =
          this.getAggregationWithEarliestTransaction(aggregations)
        const sortedEntities = sortBy(
          targetAggregationToUpdate?.entities ?? [],
          'timestamp'
        )
        const targetEntities = drop(sortedEntities, 1)
        const newUpdatedAggregationData = targetEntities.map(
          (entity) => entity.value
        )
        if (isEqual(targetAggregationToUpdate, targetAggregation)) {
          targetAggregation = {
            ...targetAggregation,
            value: aggregator.aggregate(newUpdatedAggregationData),
            entities: targetEntities,
          }
        } else if (
          targetAggregationToUpdate &&
          !isEqual(targetAggregationToUpdate, targetAggregation)
        ) {
          updatedAggregationData = {
            ...targetAggregationToUpdate,
            value: aggregator.aggregate(newUpdatedAggregationData),
            entities: targetEntities,
          }
        }
      }
    }
    const newTargetAggregation: AggregationData = {
      value: aggregator.reduce(targetAggregation.value, newDataValue),
      entities: (targetAggregation.entities ?? []).concat({
        timestamp: transaction.timestamp,
        value: newDataValue,
      }),
    }
    if (!isEqual(newTargetAggregation, omit(targetAggregation, 'time'))) {
      await this.aggregationRepository.rebuildUserTimeAggregations(
        userKeyId,
        aggregationVariable,
        {
          [targetAggregation.time]: newTargetAggregation,
          ...(updatedAggregationData
            ? { [updatedAggregationData.time]: updatedAggregationData }
            : {}),
        },
        newGroupValue
      )
    }
    await this.aggregationRepository.setTransactionApplied(
      aggregationVariable,
      direction,
      transaction.transactionId
    )
    logger.info('Updated aggregation')
  }

  private getAggregationWithEarliestTransaction(
    aggregations:
      | ({
          time: string
        } & AggregationData<unknown>)[]
      | undefined
  ) {
    return minBy(
      aggregations,
      (obj) => minBy(obj?.entities ?? [], 'timestamp')?.timestamp
    )
  }

  private getTransactionFieldsToFetch(
    aggregationVariable: RuleAggregationVariable,
    userFilterDirection: Set<string>
  ): string[] {
    const fieldsToFetch: Set<string> = new Set()

    const addFieldToFetch = (variableKey: string) => {
      const entityVar = getRuleVariableByKey(variableKey)
      if (entityVar?.entity === 'TRANSACTION') {
        fieldsToFetch.add((entityVar as TransactionRuleVariable).sourceField)
      }
    }
    if (aggregationVariable.filtersLogic) {
      getVariableKeysFromLogic(
        aggregationVariable.filtersLogic
      ).entityVariableKeys.forEach((variable) => {
        addFieldToFetch(variable)
      })
    }
    if (aggregationVariable.aggregationFieldKey) {
      addFieldToFetch(aggregationVariable.aggregationFieldKey)
    }
    if (aggregationVariable.aggregationGroupByFieldKey) {
      addFieldToFetch(aggregationVariable.aggregationGroupByFieldKey)
    }
    if (aggregationVariable.secondaryAggregationFieldKey) {
      addFieldToFetch(aggregationVariable.secondaryAggregationFieldKey)
    }

    if (userFilterDirection.has('sender')) {
      fieldsToFetch.add('originUserId')
    }
    if (userFilterDirection.has('receiver')) {
      fieldsToFetch.add('destinationUserId')
    }
    return uniq([
      ...Array.from(fieldsToFetch),
      'senderKeyId',
      'receiverKeyId',
      'timestamp',
    ])
  }

  private async loadAggregationData(
    direction: 'origin' | 'destination',
    aggregationVariable: RuleAggregationVariable,
    data: RuleData
  ) {
    const { aggregationFunc } = aggregationVariable
    const { afterTimestamp, beforeTimestamp } = getTimeRangeByTimeWindows(
      data.type === 'TRANSACTION' ? data.transaction.timestamp : Date.now(),
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )

    const aggregationGranularity = getAggregationGranularity(
      aggregationVariable.timeWindow,
      this.tenantId
    )
    const userIdentifier: UserIdentifier =
      data.type === 'TRANSACTION'
        ? {
            userId:
              direction === 'origin'
                ? data.transaction.originUserId
                : data.transaction.destinationUserId,
            paymentDetails:
              direction === 'origin'
                ? data.transaction.originPaymentDetails
                : data.transaction.destinationPaymentDetails,
          }
        : { userId: data.user.userId }

    const aggregator = getRuleVariableAggregator(aggregationFunc)
    const entityVarDataloader = this.entityVarLoader(data, {
      baseCurrency: aggregationVariable.baseCurrency,
      tenantId: this.tenantId,
      dynamoDb: this.dynamoDb,
    })
    const newGroupValue = aggregationVariable.aggregationGroupByFieldKey
      ? ((await entityVarDataloader.load(
          getEntityVariableLoaderKey({
            key: aggregationVariable.aggregationGroupByFieldKey,
            entityKey: aggregationVariable.aggregationGroupByFieldKey,
          })
        )) as string)
      : undefined
    let aggData: Array<{ time: string } & AggregationData> = []
    if (
      this.mode === 'DYNAMODB' &&
      canAggregate(aggregationVariable.timeWindow)
    ) {
      // If the mode is DYNAMODB, we fetch the pre-built aggregation data
      const userKeyId =
        data.type === 'TRANSACTION'
          ? this.getUserKeyId(
              data.transaction,
              direction,
              aggregationVariable.type
            )
          : data.user.userId
      if (!userKeyId) {
        return null
      }
      aggData =
        (await this.aggregationRepository.getUserRuleTimeAggregations(
          userKeyId,
          aggregationVariable,
          afterTimestamp,
          beforeTimestamp,
          aggregationGranularity,
          newGroupValue
        )) ?? []
    } else {
      // If the mode is MONGODB, we rebuild the fresh aggregation data (without persisting the aggregation data)
      aggData = await this.loadAggregationDataFromRawData(
        aggregationVariable,
        userIdentifier,
        afterTimestamp,
        beforeTimestamp,
        newGroupValue
      )
    }
    let aggregationEntitiesCount = aggData.reduce(
      (acc, cur: AggregationData) => {
        return acc + (cur.entities?.length ?? 0)
      },
      0
    )
    let result = aggData.reduce((acc: unknown, cur: AggregationData) => {
      return mergeValues(aggregator, acc, cur.value ?? aggregator.init())
    }, aggregator.init())

    const newTransactionIsTargetDirection =
      (direction === 'origin' &&
        aggregationVariable.transactionDirection !== 'RECEIVING') ||
      (direction === 'destination' &&
        aggregationVariable.transactionDirection !== 'SENDING')
    if (
      data.type === 'TRANSACTION' &&
      aggregationVariable.includeCurrentEntity &&
      newTransactionIsTargetDirection &&
      this.isNewDataWithinTimeWindow(data, afterTimestamp, beforeTimestamp)
    ) {
      const [shouldIncludeNewData, shouldSkipUpdateAggregation] =
        await Promise.all([
          this.isDataIncludedInAggregationVariable(aggregationVariable, data),
          this.isTransactionApplied(
            aggregationVariable,
            direction,
            data.transaction.transactionId
          ),
        ])
      if (shouldIncludeNewData && !shouldSkipUpdateAggregation) {
        const aggFieldKey = this.getAggregationVarFieldKey(
          aggregationVariable,
          direction
        )
        const newDataValue = await entityVarDataloader.load(
          getEntityVariableLoaderKey({
            key: aggFieldKey,
            entityKey: aggFieldKey,
          })
        )
        // NOTE: Merge the incoming transaction/user into the aggregation result
        if (newDataValue) {
          result = aggregator.reduce(result, newDataValue)
          aggregationEntitiesCount++
        }
      }
    }
    if (aggregationEntitiesCount < (aggregationVariable.lastNEntities ?? 0)) {
      return null
    }
    return aggregator.compute(result)
  }

  private async loadAggregationDataFromRawData(
    aggregationVariable: RuleAggregationVariable,
    userIdentifier: {
      userId?: string
      paymentDetails?: PaymentDetails
    },
    afterTimestamp: number,
    beforeTimestamp: number,
    groupValue: string | undefined
  ): Promise<Array<{ time: string } & AggregationData>> {
    const rebuiltAggData = await this.getRebuiltAggregationVariableResult(
      aggregationVariable,
      {
        userId: userIdentifier.userId,
        paymentDetails: userIdentifier.paymentDetails,
      },
      {
        afterTimestamp,
        beforeTimestamp,
      }
    )
    return Object.entries(rebuiltAggData).map(([time, value]) => ({
      time,
      ...(groupValue ? value[groupValue] : value),
    }))
  }

  private async isDataIncludedInAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    data: RuleData
  ) {
    if (isEmpty(aggregationVariable.filtersLogic)) {
      return true
    }

    const { entityVariableKeys } = getVariableKeysFromLogic(
      aggregationVariable.filtersLogic
    )

    // Load the last transaction event for the transaction if the filters logic
    // contains a transaction event entity variable.
    // This is a less efficient approach as we need to load tx event one by one
    // TODO: Optimize loading transaction events
    if (
      data.type === 'TRANSACTION' &&
      isEmpty(data.transactionEvents) &&
      entityVariableKeys.find((v) =>
        v.startsWith(TRANSACTION_EVENT_ENTITY_VARIABLE_TYPE)
      )
    ) {
      await this.initialize()
      if (this.transactionEventRepository) {
        const lastTransactionEvent =
          this.mode === 'DYNAMODB'
            ? await this.transactionEventRepository.getLastTransactionEvent(
                data.transaction.transactionId
              )
            : await this.transactionEventRepository.getMongoLastTransactionEvent(
                data.transaction.transactionId
              )
        if (lastTransactionEvent) {
          data.transactionEvents = [lastTransactionEvent]
        }
      }
    }

    const filterResult = await this.evaluate(
      aggregationVariable.filtersLogic,
      {},
      {
        baseCurrency: aggregationVariable.baseCurrency,
        tenantId: this.tenantId,
      },
      data
    )
    return filterResult.hit
  }

  private isNewDataWithinTimeWindow(
    data: TransactionRuleData,
    afterTimestamp: number,
    beforeTimestamp: number
  ): boolean {
    return (
      data.transaction.timestamp !== undefined &&
      data.transaction.timestamp >= afterTimestamp &&
      data.transaction.timestamp <= beforeTimestamp
    )
  }

  private getAggregationVarFieldKey(
    aggregationVariable: RuleAggregationVariable,
    direction: 'origin' | 'destination'
  ) {
    if (aggregationVariable.transactionDirection === 'SENDING_RECEIVING') {
      return direction === 'origin'
        ? aggregationVariable.aggregationFieldKey
        : aggregationVariable.secondaryAggregationFieldKey ??
            aggregationVariable.aggregationFieldKey
    }
    return aggregationVariable.aggregationFieldKey
  }

  public updatedAggregationVariables: Set<string> = new Set()

  public async handleV8Aggregation(
    type: 'RULES' | 'RISK',
    logicAggregationVariables: RuleAggregationVariable[],
    transaction: TransactionWithRiskDetails,
    transactionEvents: TransactionEvent[]
  ): Promise<
    Array<{
      MessageBody: string
      MessageGroupId: string
      MessageDeduplicationId: string
    }>
  > {
    if (
      (!hasFeature('RULES_ENGINE_V8') && type === 'RULES') ||
      (!hasFeature('RISK_FACTORS_V8') && type === 'RISK')
    ) {
      return []
    }

    const promises =
      logicAggregationVariables?.flatMap((aggVar) => {
        const hash = getAggVarHash(aggVar)
        if (this.updatedAggregationVariables.has(hash)) {
          return
        }

        this.updatedAggregationVariables.add(hash)

        return [
          aggVar.transactionDirection !== 'RECEIVING'
            ? this.updateAggregationVariable(
                aggVar,
                { transaction, transactionEvents, type: 'TRANSACTION' },
                'origin'
              )
            : undefined,
          aggVar.transactionDirection !== 'SENDING'
            ? this.updateAggregationVariable(
                aggVar,
                { transaction, transactionEvents, type: 'TRANSACTION' },
                'destination'
              )
            : undefined,
        ].filter(Boolean)
      }) ?? []

    this.isTransactionApplied.cache.clear?.()
    return compact(await Promise.all(promises))
  }
}
