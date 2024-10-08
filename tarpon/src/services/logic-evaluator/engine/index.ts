import { AsyncLogicEngine } from 'json-logic-engine'
import memoizeOne from 'memoize-one'
import DataLoader from 'dataloader'
import {
  compact,
  drop,
  find,
  groupBy,
  isEmpty,
  isEqual,
  isUndefined,
  last,
  mapValues,
  memoize,
  mergeWith,
  minBy,
  omit,
  omitBy,
  size,
  sortBy,
  uniq,
} from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { LOGIC_FUNCTIONS } from '../functions'
import {
  getLogicVariableByKey,
  getTransactionLogicEntityVariables,
  isSenderUserVariable,
} from '../variables'
import {
  getLogicVariableAggregator,
  mergeGroups,
  mergeValues,
} from '../variable-aggregators'
import {
  BusinessUserLogicVariable,
  CommonUserLogicVariable,
  ConsumerUserLogicVariable,
  LogicVariableContext,
  TransactionEventLogicVariable,
  TransactionLogicVariable,
} from '../variables/types'
import { getPaymentDetailsIdentifiersKey } from '../variables/payment-details'
import { CUSTOM_BUILT_IN_LOGIC_OPERATORS } from '../operators/custom-built-in-operators'
import { LOGIC_OPERATORS } from '../operators'
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
import { logger } from '@/core/logger'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { getContext, hasFeature } from '@/core/utils/context'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { batchWrite, BatchWriteRequestInternal } from '@/utils/dynamodb'
import { addNewSubsegment } from '@/core/xray'
import {
  AuxiliaryIndexTransaction,
  TransactionWithRiskDetails,
} from '@/services/rules-engine/repositories/transaction-repository-interface'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import {
  getTransactionsGenerator,
  getTransactionStatsTimeGroupLabel,
  groupTransactionsByGranularity,
  hydrateTransactionEvents,
} from '@/services/rules-engine/utils/transaction-rule-utils'
import { getTimeRangeByTimeWindows } from '@/services/rules-engine/utils/time-utils'
import { TimeWindow } from '@/services/rules-engine/utils/rule-parameter-schemas'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { LogicEntityVariableEntityEnum } from '@/@types/openapi-internal/LogicEntityVariable'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { LogicAggregationType } from '@/@types/openapi-internal/LogicAggregationType'
import { ExecutedLogicVars } from '@/@types/openapi-internal/ExecutedLogicVars'
import { LogicConfig } from '@/@types/openapi-internal/LogicConfig'
import { Tag } from '@/@types/openapi-public/Tag'

export type TransactionLogicData = {
  type: 'TRANSACTION'
  transaction: TransactionWithRiskDetails
  transactionEvents: TransactionEventWithRulesResult[]
  senderUser?: User | Business
  receiverUser?: User | Business
}

export type UserLogicData = {
  type: 'USER'
  user: User | Business
}
export type LogicData = TransactionLogicData | UserLogicData
type UserIdentifier = {
  userId?: string
  paymentDetails?: PaymentDetails
}

export type AuxiliaryIndexTransactionWithDirection =
  AuxiliaryIndexTransaction & {
    direction?: 'origin' | 'destination'
  }
const TRANSACTION_EVENT_ENTITY_VARIABLE_TYPE: LogicEntityVariableEntityEnum =
  'TRANSACTION_EVENT'

export const getJsonLogicEngine = memoizeOne(
  (context?: { tenantId: string; dynamoDb: DynamoDBDocumentClient }) => {
    const jsonLogicEngine = new AsyncLogicEngine()
    LOGIC_FUNCTIONS.filter((v) => v.run).forEach((v) =>
      jsonLogicEngine.addMethod(v.key, v.run)
    )
    CUSTOM_BUILT_IN_LOGIC_OPERATORS.concat(LOGIC_OPERATORS).forEach((v) =>
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
  entityVariable: LogicEntityVariableInUse
): Omit<LogicEntityVariableInUse, 'name'> {
  const { filtersLogic } = entityVariable
  return {
    key: entityVariable.key,
    entityKey: entityVariable.entityKey,
    filtersLogic: isEmpty(filtersLogic) ? undefined : filtersLogic,
  }
}

type Mode = 'MONGODB' | 'DYNAMODB'
export class LogicEvaluator {
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

  public getLogicConfig() {
    return {
      variables: Object.values(getTransactionLogicEntityVariables()),
      operators: LOGIC_OPERATORS,
      functions: LOGIC_FUNCTIONS,
    } as LogicConfig
  }

  public async evaluate(
    rawJsonLogic: object,
    variables: {
      agg?: LogicAggregationVariable[]
      entity?: LogicEntityVariableInUse[]
    },
    context: Omit<LogicVariableContext, 'dynamoDb'>,
    data: LogicData
  ): Promise<{
    hit: boolean
    hitDirections: RuleHitDirection[]
    vars: ExecutedLogicVars[]
  }> {
    const traceNamespace = `${getContext()?.metricDimensions?.ruleInstanceId}`
    const v8SubSegment = await addNewSubsegment(
      traceNamespace,
      'Logic Evaluation'
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
      .filter(Boolean) as LogicAggregationVariable[]
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
    const vars: ExecutedLogicVars[] = []
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
    context: LogicVariableContext
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
    (data: LogicData, context: LogicVariableContext) => {
      return new DataLoader<
        Omit<LogicEntityVariableInUse, 'name'>,
        any,
        string
      >(
        async (entityVariables) => {
          return Promise.all(
            entityVariables.map(async (entityVariable) => {
              const variable = getLogicVariableByKey(
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
                return (variable as TransactionLogicVariable<any>).load(
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
                return (variable as TransactionEventLogicVariable<any>).load(
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
                return (variable as ConsumerUserLogicVariable<any>).load(
                  user as User,
                  context
                )
              }
              if (variable.entity === 'BUSINESS_USER') {
                return (variable as BusinessUserLogicVariable<any>).load(
                  user as Business,
                  context
                )
              }
              if (variable.entity === 'USER') {
                return (variable as CommonUserLogicVariable<any>).load(
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
    (data: LogicData) => {
      return new DataLoader(
        async (
          variableKeys: readonly {
            direction: 'origin' | 'destination'
            aggVariable: LogicAggregationVariable
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
      aggregationVariable: LogicAggregationVariable,
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
    type: LogicAggregationType
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
    aggregationVariable: LogicAggregationVariable,
    data: TransactionLogicData,
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
    aggregationVariable: LogicAggregationVariable,
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

    const { ready } =
      await this.aggregationRepository.isAggregationVariableReady(
        aggregationVariable,
        userKeyId
      )
    if (ready) {
      return
    }

    logger.info('Rebuilding aggregation...')
    const { afterTimestamp } = getTimeRangeByTimeWindows(
      currentTimestamp,
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )
    const { result: aggregationResult, lastTransactionTimestamp } =
      await this.getRebuiltAggregationVariableResult(
        aggregationVariable,
        {
          userId,
          paymentDetails,
        },
        {
          afterTimestamp,
          beforeTimestamp: currentTimestamp,
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
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
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
      userKeyId,
      lastTransactionTimestamp
    )
    logger.info('Rebuilt aggregation')
  }

  private async getRebuiltAggregationVariableResult(
    aggregationVariable: LogicAggregationVariable,
    userIdentifier: UserIdentifier,
    timeRange: { afterTimestamp: number; beforeTimestamp: number }
  ): Promise<{
    result: { [time: string]: AggregationData }
    lastTransactionTimestamp: number
  }> {
    const aggregator = getLogicVariableAggregator(
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
    let lastTransactionTimestamp = 0
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

      if (
        transactions[0]?.timestamp &&
        transactions?.[0]?.timestamp > lastTransactionTimestamp
      ) {
        lastTransactionTimestamp = transactions[0].timestamp
      }

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
      const sendingTxEntityVariable = getLogicVariableByKey(
        this.getAggregationVarFieldKey(aggregationVariable, 'origin')
      ) as TransactionLogicVariable
      const receivingTxEntityVariable = getLogicVariableByKey(
        this.getAggregationVarFieldKey(aggregationVariable, 'destination')
      ) as TransactionLogicVariable
      const txGroupByEntityVariable =
        aggregationVariable.aggregationGroupByFieldKey
          ? (getLogicVariableByKey(
              aggregationVariable.aggregationGroupByFieldKey
            ) as TransactionLogicVariable)
          : undefined
      const context: LogicVariableContext = {
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
                let value = await entityVariable?.load(transaction, context)
                if (
                  aggregationVariable.aggregationFilterFieldKey &&
                  aggregationVariable.aggregationFilterFieldValue
                ) {
                  value = (value as { [key: string]: unknown }[])
                    .filter(
                      (v) =>
                        v.key ===
                        aggregationVariable.aggregationFilterFieldValue
                    )
                    ?.map((v) => v.value)
                }
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
          const values = filteredAggregateValues.flatMap((v) => v.value)
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
    return { result: timeAggregatedResult, lastTransactionTimestamp }
  }

  public async updateAggregationVariable(
    aggregationVariable: LogicAggregationVariable,
    data: TransactionLogicData,
    options?: { skipIfNotReady?: boolean }
  ) {
    if (
      this.mode !== 'DYNAMODB' ||
      !canAggregate(aggregationVariable.timeWindow)
    ) {
      return
    }
    const { transaction } = data

    const directions = compact([
      aggregationVariable.transactionDirection !== 'RECEIVING'
        ? 'origin'
        : undefined,
      aggregationVariable.transactionDirection !== 'SENDING'
        ? 'destination'
        : undefined,
    ])

    await Promise.all(
      directions.map(async (direction) => {
        const userKeyId = this.getUserKeyId(
          transaction,
          direction,
          aggregationVariable.type
        )
        if (!userKeyId) {
          return
        }
        if (options?.skipIfNotReady) {
          const { ready, lastTransactionTimestamp } =
            await this.aggregationRepository.isAggregationVariableReady(
              aggregationVariable,
              userKeyId
            )
          if (!ready || lastTransactionTimestamp >= transaction.timestamp) {
            return
          }
        }
        await this.updateAggregationVariableInternal(
          aggregationVariable,
          data,
          direction,
          userKeyId
        )
      })
    )
  }

  private async updateAggregationVariableInternal(
    aggregationVariable: LogicAggregationVariable,
    data: TransactionLogicData,
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
    const newDataValue = await this.getNewDataValueForAggregation(
      aggregationVariable,
      entityVarDataloader,
      direction
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

    const aggregator = getLogicVariableAggregator(
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

    let targetAggregation: ({ time: string } & AggregationData) | undefined

    if (aggregationVariable.lastNEntities) {
      const aggregations =
        await this.aggregationRepository.getUserLogicTimeAggregations(
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
      const groupLabel = getTransactionStatsTimeGroupLabel(
        transaction.timestamp,
        aggregationGranularity
      )
      targetAggregation = find(aggregations, (obj) =>
        isEqual(obj.time, groupLabel)
      )
      if (
        entitiesCountInAggregation > aggregationVariable.lastNEntities &&
        aggregations
      ) {
        const {
          newUpdatedAggregationData,
          targetAggregationToUpdate,
          targetEntities,
        } = this.getLastNMinusOneAggregationResult(aggregations)

        if (isUndefined(targetAggregationToUpdate)) {
          throw new Error('targetAggregationToUpdate is undefined')
        }
        if (isEqual(targetAggregationToUpdate, targetAggregation)) {
          targetAggregation = {
            ...targetAggregationToUpdate,
            value: aggregator.aggregate(newUpdatedAggregationData ?? []),
            entities: targetEntities,
          }
        } else if (!isEqual(targetAggregationToUpdate, targetAggregation)) {
          updatedAggregationData = {
            ...targetAggregationToUpdate,
            value: aggregator.aggregate(newUpdatedAggregationData ?? []),
            entities: targetEntities,
          }
        }
      }
    } else {
      const targetAggregations =
        await this.aggregationRepository.getUserLogicTimeAggregations(
          userKeyId,
          aggregationVariable,
          transaction.timestamp,
          transaction.timestamp + 1,
          aggregationGranularity,
          newGroupValue
        )
      if (size(targetAggregations) > 1) {
        throw new Error('Should only get one target aggregation')
      }
      targetAggregation = targetAggregations?.[0]
    }

    targetAggregation = targetAggregation ?? {
      time: getTransactionStatsTimeGroupLabel(
        transaction.timestamp,
        aggregationGranularity
      ),
      value: aggregator.init(),
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

  private async getNewDataValueForAggregation(
    aggregationVariable: LogicAggregationVariable,
    entityVarDataloader: DataLoader<
      Omit<LogicEntityVariableInUse, 'name'>,
      any,
      string
    >,
    direction: 'origin' | 'destination'
  ) {
    const { aggregationFilterFieldValue, aggregationFilterFieldKey } =
      aggregationVariable
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
    if (newDataValue == null) {
      return newDataValue
    }
    if (!aggregationFilterFieldKey) {
      return [newDataValue]
    }
    if (aggregationFilterFieldValue) {
      const tagValue = newDataValue
        .filter((v: Tag) => v.key === aggregationFilterFieldValue)
        .map((v: Tag) => v.value)
      return tagValue
    }
    return [newDataValue]
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
    aggregationVariable: LogicAggregationVariable,
    userFilterDirection: Set<string>
  ): string[] {
    const fieldsToFetch: Set<string> = new Set()

    const addFieldToFetch = (variableKey: string) => {
      const entityVar = getLogicVariableByKey(variableKey)
      if (entityVar?.entity === 'TRANSACTION') {
        fieldsToFetch.add((entityVar as TransactionLogicVariable).sourceField)
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

  private getLastNMinusOneAggregationResult(
    aggregations: Array<{ time: string } & AggregationData>
  ) {
    const targetAggregationToUpdate =
      this.getAggregationWithEarliestTransaction(aggregations)
    const sortedEntities = sortBy(
      targetAggregationToUpdate?.entities ?? [],
      'timestamp'
    )
    const targetEntities = drop(sortedEntities, 1)
    const newUpdatedAggregationData = targetEntities.flatMap(
      (entity) => entity.value
    )
    const newValuesToAggregate = [
      ...targetEntities.flatMap((e) => e.value),
      ...aggregations
        .filter((obj) => obj.time !== targetAggregationToUpdate?.time)
        .flatMap((obj) => obj.entities?.flatMap((e) => e.value) ?? []),
    ]
    return {
      newUpdatedAggregationData,
      targetAggregationToUpdate,
      targetEntities,
      newValuesToAggregate,
    }
  }

  private async loadAggregationData(
    direction: 'origin' | 'destination',
    aggregationVariable: LogicAggregationVariable,
    data: LogicData
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

    const aggregator = getLogicVariableAggregator(aggregationFunc)
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
        (await this.aggregationRepository.getUserLogicTimeAggregations(
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
    let result = aggregator.init()
    if (
      aggregationVariable.lastNEntities &&
      aggregationEntitiesCount === aggregationVariable.lastNEntities &&
      aggregationVariable.includeCurrentEntity
    ) {
      const aggResult = this.getLastNMinusOneAggregationResult(aggData)
      result =
        aggregator.aggregate(aggResult?.newValuesToAggregate ?? []) ??
        aggregator.init()
    } else {
      result = aggData.reduce((acc: unknown, cur: AggregationData) => {
        return mergeValues(aggregator, acc, cur.value ?? aggregator.init())
      }, aggregator.init())
    }
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
        const newDataValue = await this.getNewDataValueForAggregation(
          aggregationVariable,
          entityVarDataloader,
          direction
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
    aggregationVariable: LogicAggregationVariable,
    userIdentifier: {
      userId?: string
      paymentDetails?: PaymentDetails
    },
    afterTimestamp: number,
    beforeTimestamp: number,
    groupValue: string | undefined
  ): Promise<Array<{ time: string } & AggregationData>> {
    const { result: rebuiltAggData } =
      await this.getRebuiltAggregationVariableResult(
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
    aggregationVariable: LogicAggregationVariable,
    data: LogicData
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
    data: TransactionLogicData,
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
    aggregationVariable: LogicAggregationVariable,
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
    logicAggregationVariables: LogicAggregationVariable[],
    transaction: TransactionWithRiskDetails,
    transactionEvents: TransactionEvent[]
  ) {
    if (
      hasFeature('RULES_ENGINE_V8_ASYNC_AGGREGATION') ||
      (!hasFeature('RULES_ENGINE_V8') && type === 'RULES') ||
      (!hasFeature('RISK_SCORING_V8') && type === 'RISK')
    ) {
      return
    }

    const promises =
      logicAggregationVariables?.flatMap((aggVar) => {
        const hash = getAggVarHash(aggVar)
        if (this.updatedAggregationVariables.has(hash)) {
          return
        }

        this.updatedAggregationVariables.add(hash)
        return this.updateAggregationVariable(aggVar, {
          transaction,
          transactionEvents,
          type: 'TRANSACTION',
        })
      }) ?? []

    await Promise.all(promises)
    this.isTransactionApplied.cache.clear?.()
  }
}
