import { AsyncLogicEngine } from 'json-logic-engine'
import memoizeOne from 'memoize-one'
import DataLoader from 'dataloader'
import {
  groupBy,
  isEmpty,
  isEqual,
  last,
  mapValues,
  memoize,
  mergeWith,
  omit,
  uniq,
} from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { canAggregateMinute } from '@flagright/lib/rules-engine'
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
  getTransactionStatsTimeGroupLabel,
  getTransactionsGenerator,
  groupTransactionsByGranularity,
  hydrateTransactionEvents,
} from '../utils/transaction-rule-utils'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import {
  BusinessUserRuleVariable,
  CommonUserRuleVariable,
  ConsumerUserRuleVariable,
  TransactionRuleVariable,
  RuleVariableContext,
  TransactionEventRuleVariable,
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
  getVariableKeysFromLogic,
  transformJsonLogic,
  transformJsonLogicVars,
} from './utils'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { generateChecksum } from '@/utils/object'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { logger } from '@/core/logger'
import { envIs } from '@/utils/env'
import {
  handleV8PreAggregationTask,
  handleV8TransactionAggregationTask,
} from '@/lambdas/transaction-aggregation/app'
import { getSQSClient } from '@/utils/sns-sqs-client'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { RuleAggregationType } from '@/@types/openapi-internal/RuleAggregationType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ExecutedRuleVars } from '@/@types/openapi-internal/ExecutedRuleVars'
import { RuleEntityVariableInUse } from '@/@types/openapi-internal/RuleEntityVariableInUse'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { RuleEntityVariableEntityEnum } from '@/@types/openapi-internal/RuleEntityVariable'
import { hasFeature } from '@/core/utils/context'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'

const sqs = getSQSClient()

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

type AuxiliaryIndexTransactionWithDirection = AuxiliaryIndexTransaction & {
  direction?: 'origin' | 'destination'
}
const MAX_HOURS_TO_AGGREGATE_WITH_MINUTE_GRANULARITY = 3
const TRANSACTION_EVENT_ENTITY_VARIABLE_TYPE: RuleEntityVariableEntityEnum =
  'TRANSACTION_EVENT'

export function canAggregate(variable: RuleAggregationVariable) {
  const { units: startUnits, granularity: startGranularity } =
    variable.timeWindow.start
  const { units: endUnits, granularity: endGranularity } =
    variable.timeWindow.end
  if (startGranularity === 'second' || endGranularity === 'second') {
    return false
  }
  if (startGranularity === 'minute' || endGranularity === 'minute') {
    return canAggregateMinute(
      startGranularity,
      startUnits,
      endGranularity,
      endUnits
    )
  }
  return true
}

export async function sendAggregationTask(
  task: TransactionAggregationTaskEntry
) {
  const payload = task.payload as
    | V8TransactionAggregationTask
    | V8RuleAggregationRebuildTask
  if (envIs('local') || envIs('test')) {
    if (payload.type === 'TRANSACTION_AGGREGATION') {
      await handleV8TransactionAggregationTask(payload)
    } else if (payload.type === 'PRE_AGGREGATION') {
      await handleV8PreAggregationTask(payload)
    }
    return
  }
  const command = new SendMessageCommand({
    MessageBody: JSON.stringify(payload),
    QueueUrl: process.env.TRANSACTION_AGGREGATION_QUEUE_URL,
    MessageGroupId: generateChecksum(task.userKeyId),
    MessageDeduplicationId: generateChecksum(
      `${task.userKeyId}:${getAggVarHash(payload.aggregationVariable)}:${
        payload.type === 'TRANSACTION_AGGREGATION'
          ? payload.transaction.transactionId
          : ''
      }`
    ),
  })
  await sqs.send(command)
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
    const entityVarDataloader = this.entityVarLoader(data, {
      ...context,
      dynamoDb: this.dynamoDb,
    })
    const jsonLogic = transformJsonLogic(rawJsonLogic)
    const { entityVariableKeys, aggVariableKeys } =
      getVariableKeysFromLogic(jsonLogic)
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
    // NOTE: If a aggregation variable has both user directions, we need to evaluate the logic
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
                  ? isSenderUserVariable(variable)
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
    await this.aggregationRepository.rebuildUserTimeAggregations(
      userKeyId,
      aggregationVariable,
      aggregationResult
    )
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
    const aggregationGranularity =
      this.getAggregationGranularity(aggregationVariable)

    const fieldsToFetch = this.getTransactionFieldsToFetch(aggregationVariable)
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
    let timeAggregatedResult: {
      [time: string]: AggregationData
    } = {}
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
      ]

      // Filter transactions by filtersLogic
      const targetTransactions: AuxiliaryIndexTransactionWithDirection[] = []
      for (const transaction of transactions) {
        const isTransactionFiltered =
          await this.isDataIncludedInAggregationVariable(aggregationVariable, {
            type: 'TRANSACTION',
            transaction: transaction as TransactionWithRiskDetails,
            transactionEvents: [],
          })
        if (isTransactionFiltered) {
          targetTransactions.push(transaction)
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
                  groupValue,
                }
              }
            )
          )
          const filteredAggregateValues = aggregateValues.filter((v) => {
            return v.value && (!hasGroups || v.groupValue)
          })
          const values = filteredAggregateValues.map((v) => v.value)
          return {
            value: hasGroups
              ? mapValues(
                  groupBy(filteredAggregateValues, (v) => v.groupValue),
                  (v) => aggregator.aggregate(v.map((v) => v.value))
                )
              : aggregator.aggregate(values),
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
          }
        }
      )
    }
    return timeAggregatedResult
  }

  public async updateAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    data: TransactionRuleData,
    direction: 'origin' | 'destination'
  ) {
    if (this.mode !== 'DYNAMODB' || !canAggregate(aggregationVariable)) {
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
      await sendAggregationTask(task)
      return
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
    const shouldSkipUpdateAggregation =
      await this.aggregationRepository.isTransactionApplied(
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

    const aggregationGranularity =
      this.getAggregationGranularity(aggregationVariable)

    const targetAggregations =
      (await this.aggregationRepository.getUserRuleTimeAggregations(
        userKeyId,
        aggregationVariable,
        transaction.timestamp,
        transaction.timestamp + 1,
        aggregationGranularity
      )) ?? []
    if ((targetAggregations?.length ?? 0) > 1) {
      throw new Error('Should only get one target aggregation')
    }
    const targetAggregation = targetAggregations?.[0] ?? {
      time: getTransactionStatsTimeGroupLabel(
        transaction.timestamp,
        aggregationGranularity
      ),
      value: hasGroups ? {} : aggregator.init(),
    }
    const newTargetAggregation: AggregationData = {
      value: hasGroups
        ? mergeGroups(
            aggregator,
            targetAggregation.value as { [key: string]: unknown },
            {
              [newGroupValue]: aggregator.reduce(
                aggregator.init(),
                newDataValue
              ),
            }
          )
        : aggregator.reduce(targetAggregation.value, newDataValue),
    }
    if (!isEqual(newTargetAggregation, omit(targetAggregation, 'time'))) {
      await this.aggregationRepository.rebuildUserTimeAggregations(
        userKeyId,
        aggregationVariable,
        {
          [targetAggregation.time]: newTargetAggregation,
        }
      )
    }
    await this.aggregationRepository.setTransactionApplied(
      aggregationVariable,
      direction,
      transaction.transactionId
    )
    logger.info('Updated aggregation')
  }

  private getTransactionFieldsToFetch(
    aggregationVariable: RuleAggregationVariable
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

    const aggregationGranularity =
      this.getAggregationGranularity(aggregationVariable)
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

    let aggData: Array<{ time: string } & AggregationData> = []
    if (this.mode === 'DYNAMODB' && canAggregate(aggregationVariable)) {
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
          aggregationGranularity
        )) ?? []
    } else {
      // If the mode is MONGODB, we rebuild the fresh aggregation data (without persisting the aggregation data)
      aggData = await this.loadAggregationDataFromRawData(
        aggregationVariable,
        userIdentifier,
        afterTimestamp,
        beforeTimestamp
      )
    }
    const aggregator = getRuleVariableAggregator(aggregationFunc)
    const hasGroups = Boolean(aggregationVariable.aggregationGroupByFieldKey)
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
    let result = aggData.reduce((acc: unknown, cur: AggregationData) => {
      const curValue = cur.value
      return mergeValues(
        aggregator,
        acc,
        (hasGroups ? curValue?.[newGroupValue as string] : cur.value) ??
          aggregator.init()
      )
    }, aggregator.init())

    const newTransactionIsTargetDirection =
      (direction === 'origin' &&
        aggregationVariable.transactionDirection !== 'RECEIVING') ||
      (direction === 'destination' &&
        aggregationVariable.transactionDirection !== 'SENDING')
    if (
      data.type === 'TRANSACTION' &&
      aggregationVariable.aggregationFunc !== 'UNIQUE_VALUES' &&
      newTransactionIsTargetDirection &&
      this.isNewDataWithinTimeWindow(data, afterTimestamp, beforeTimestamp)
    ) {
      const shouldIncludeNewData =
        await this.isDataIncludedInAggregationVariable(
          aggregationVariable,
          data
        )
      if (shouldIncludeNewData) {
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
        }
      }
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
    beforeTimestamp: number
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
      ...value,
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
      !isEmpty(data.transactionEvents) &&
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

  private getAggregationGranularity(
    aggregationVariable: RuleAggregationVariable
  ) {
    const maxHoursToAggregateWithMinuteGranularity =
      // TODO: to be reverted in FR-5010
      this.tenantId === 'QYF2BOXRJI' // Capimoney
        ? 24
        : MAX_HOURS_TO_AGGREGATE_WITH_MINUTE_GRANULARITY

    let start = aggregationVariable.timeWindow.start
    const end = aggregationVariable.timeWindow.end

    // TODO: to be reverted in FR-5010
    if (start.granularity === 'day' && start.units === 1) {
      start = { units: 24, granularity: 'hour' }
    }

    if (end.granularity === 'all_time') {
      return 'year'
    }
    if (start.rollingBasis || end.rollingBasis) {
      return 'hour'
    }

    if (end.granularity === 'now') {
      return start.granularity === 'hour' &&
        start.units <= maxHoursToAggregateWithMinuteGranularity
        ? 'minute'
        : start.granularity
    }
    return start.granularity === 'hour' &&
      start.units - (end.granularity === 'hour' ? end.units : 0) <=
        maxHoursToAggregateWithMinuteGranularity
      ? 'minute'
      : end.granularity
  }

  public updatedAggregationVariables: Set<string> = new Set()

  public async handleV8Aggregation(
    type: 'RULES' | 'RISK',
    logicAggregationVariables: RuleAggregationVariable[],
    transaction: TransactionWithRiskDetails,
    transactionEvents: TransactionEvent[]
  ) {
    if (
      (!hasFeature('RULES_ENGINE_V8') && type === 'RULES') ||
      (!hasFeature('RISK_FACTORS_V8') && type === 'RISK')
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

    await Promise.all(promises)
  }
}
