import { AsyncLogicEngine } from 'json-logic-engine'
import memoizeOne from 'memoize-one'
import DataLoader from 'dataloader'
import {
  groupBy,
  isEqual,
  isNil,
  mapValues,
  memoize,
  mergeWith,
  omit,
  uniq,
} from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import dayjs from '@flagright/lib/utils/dayjs'
import { RULE_FUNCTIONS } from '../v8-functions'
import { RULE_OPERATORS } from '../v8-operators'
import { getRuleVariableByKey, isSenderUserVariable } from '../v8-variables'
import { getTimestampRange } from '../utils/time-utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import {
  getRuleVariableAggregator,
  mergeGroups,
  mergeValues,
} from '../v8-variable-aggregators'
import {
  TransactionAggregationTaskEntry,
  V8TransactionAggregationTask,
} from '../rules-engine-service'
import {
  getTransactionStatsTimeGroupLabel,
  getTransactionsGenerator,
  groupTransactionsByGranularity,
} from '../utils/transaction-rule-utils'
import { DynamoDbTransactionRepository } from '../repositories/dynamodb-transaction-repository'
import {
  BusinessUserRuleVariable,
  CommonUserRuleVariable,
  ConsumerUserRuleVariable,
  TransactionRuleVariable,
  RuleVariableContext,
} from '../v8-variables/types'
import { getPaymentDetailsIdentifiersKey } from '../v8-variables/payment-details'
import { AuxiliaryIndexTransaction } from '../repositories/transaction-repository-interface'
import { MongoDbTransactionRepository } from '../repositories/mongodb-transaction-repository'
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
import { handleV8TransactionAggregationTask } from '@/lambdas/transaction-aggregation/app'
import { getSQSClient } from '@/utils/sns-sqs-client'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { RuleAggregationType } from '@/@types/openapi-internal/RuleAggregationType'
import { RuleAggregationTimeWindow } from '@/@types/openapi-internal/RuleAggregationTimeWindow'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { ExecutedRuleVars } from '@/@types/openapi-internal/ExecutedRuleVars'

const sqs = getSQSClient()

type RuleData = {
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
}
type AuxiliaryIndexTransactionWithDirection = AuxiliaryIndexTransaction & {
  direction?: 'origin' | 'destination'
}

export const getJsonLogicEngine = memoizeOne(
  (context?: { tenantId: string; dynamoDb: DynamoDBDocumentClient }) => {
    const jsonLogicEngine = new AsyncLogicEngine()
    RULE_FUNCTIONS.filter((v) => v.run).forEach((v) =>
      jsonLogicEngine.addMethod(v.key, v.run)
    )
    RULE_OPERATORS.forEach((v) =>
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

const getDataLoader = memoizeOne(
  (data: RuleData, context: RuleVariableContext) => {
    return new DataLoader(async (variableKeys: readonly string[]) => {
      return Promise.all(
        variableKeys.map(async (variableKey) => {
          const variable = getRuleVariableByKey(variableKey)
          if (!variable) {
            logger.error(`Rule variable not found: ${variableKey}`)
            return null
          }
          if (variable.entity === 'TRANSACTION') {
            return (variable as TransactionRuleVariable<any>).load(
              data.transaction,
              context
            )
          }

          const user = isSenderUserVariable(variable)
            ? data.senderUser
            : data.receiverUser

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
            return (variable as CommonUserRuleVariable<any>).load(user, context)
          }
          return null
        })
      )
    })
  },
  // Don't take dynamoDb into account
  (a, b) => isEqual(a.slice(0, 2), b.slice(0, 2))
)

type Mode = 'MONGODB' | 'DYNAMODB'
export class RuleJsonLogicEvaluator {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private aggregationRepository: AggregationRepository
  private mode: Mode

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

  public setMode(mode: Mode) {
    this.mode = mode
  }

  public async evaluate(
    rawJsonLogic: object,
    aggregationVariables: RuleAggregationVariable[],
    context: Omit<RuleVariableContext, 'dynamoDb'>,
    data: RuleData
  ): Promise<{
    hit: boolean
    hitDirections: RuleHitDirection[]
    vars: ExecutedRuleVars[]
  }> {
    const entityVarDataloader = getDataLoader(data, {
      ...context,
      dynamoDb: this.dynamoDb,
    })
    const jsonLogic = transformJsonLogic(rawJsonLogic)
    const { entityVariableKeys, aggVariableKeys } =
      getVariableKeysFromLogic(jsonLogic)
    const entityVarEntries = await Promise.all(
      entityVariableKeys.map(async (key) => [
        key,
        await entityVarDataloader.load(key),
      ])
    )
    const aggVariables = aggVariableKeys
      .map((key) => {
        const aggVariable = aggregationVariables.find((v) => v.key === key)
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
        const aggEntityVarDataloader = getDataLoader(data, {
          baseCurrency: aggVariable.baseCurrency,
          tenantId: this.tenantId,
          dynamoDb: this.dynamoDb,
        })

        const aggregationVarLoader = this.aggregationVarLoader(
          data,
          aggEntityVarDataloader
        )

        return {
          variable: aggVariable,
          ORIGIN:
            aggVariable.userDirection !== 'RECEIVER' &&
            aggVariable.transactionDirection !== 'RECEIVING'
              ? await aggregationVarLoader.load({
                  direction: 'origin',
                  aggVariable,
                })
              : null,
          DESTINATION:
            aggVariable.userDirection !== 'SENDER' &&
            aggVariable.transactionDirection !== 'SENDING'
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
    return {
      hit,
      hitDirections: hit ? uniq(hitDirections) : [],
      vars,
    }
  }

  private aggregationVarLoader = memoizeOne(
    (data: RuleData, entityVarDataloader: DataLoader<string, unknown>) =>
      new DataLoader(
        async (
          variableKeys: readonly {
            direction: 'origin' | 'destination'
            aggVariable: RuleAggregationVariable
          }[]
        ) => {
          return Promise.all(
            variableKeys.map(async ({ direction, aggVariable }) => {
              return this.loadAggregationData(
                direction,
                aggVariable,
                data,
                entityVarDataloader
              )
            })
          )
        },
        {
          cacheKeyFn: ({ direction, aggVariable }) => {
            return `${direction}-${getAggVarHash(aggVariable)}`
          },
        }
      ),
    /** ignore entity var loader while caching */
    (a, b) => isEqual(a[0], b[0])
  )

  private getUserKeyId(
    transaction: Transaction,
    direction: 'origin' | 'destination',
    type: RuleAggregationType
  ): string | undefined {
    const userId =
      direction === 'origin'
        ? transaction.originUserId
        : transaction.destinationUserId
    if (type === 'PAYMENT_DETAILS_TRANSACTIONS' || !userId) {
      const paymentDetails =
        direction === 'origin'
          ? transaction.originPaymentDetails
          : transaction.destinationPaymentDetails
      if (paymentDetails) {
        return getPaymentDetailsIdentifiersKey(paymentDetails)
      }
      return undefined
    } else {
      return userId
    }
  }

  /**
   * Aggregation related
   */

  public async rebuildOrUpdateAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    data: RuleData,
    direction: 'origin' | 'destination'
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }

    const userKeyId = this.getUserKeyId(
      data.transaction,
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
      await this.rebuildAggregationVariable(
        aggregationVariable,
        data,
        direction,
        userKeyId
      )
    }
    await this.updateAggregationVariableInternal(
      aggregationVariable,
      data,
      direction,
      userKeyId
    )
  }

  public async rebuildAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    ruleData: RuleData,
    direction: 'origin' | 'destination',
    userKeyId: string
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }

    logger.info('Rebuilding aggregation...')
    const { afterTimestamp, beforeTimestamp } = this.getTimeRange(
      ruleData.transaction.timestamp,
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )
    const aggregationResult = await this.getRebuiltAggregationVariableResult(
      aggregationVariable,
      {
        userId:
          direction === 'origin'
            ? ruleData.transaction.originUserId
            : ruleData.transaction.destinationUserId,
        paymentDetails:
          direction === 'origin'
            ? ruleData.transaction.originPaymentDetails
            : ruleData.transaction.destinationPaymentDetails,
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
    userIdentifier: {
      userId: string | undefined
      paymentDetails: PaymentDetails | undefined
    },
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
            transaction: transaction as Transaction,
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
            return !isNil(v.value) && (!hasGroups || !isNil(v.groupValue))
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
    data: RuleData,
    direction: 'origin' | 'destination'
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }

    const userKeyId = this.getUserKeyId(
      data.transaction,
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
          v8: true,
          aggregationVariable,
          transaction: data.transaction,
          direction,
          tenantId: this.tenantId,
        },
      }
      if (envIs('local') || envIs('test')) {
        await handleV8TransactionAggregationTask(
          task.payload as V8TransactionAggregationTask
        )
        return
      }

      const command = new SendMessageCommand({
        MessageBody: JSON.stringify(task.payload),
        QueueUrl: process.env.TRANSACTION_AGGREGATION_QUEUE_URL,
        MessageGroupId: generateChecksum(task.userKeyId),
        MessageDeduplicationId: generateChecksum(
          `${task.userKeyId}:${getAggVarHash(aggregationVariable)}:${
            data.transaction.transactionId
          }`
        ),
      })
      await sqs.send(command)
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
    data: RuleData,
    direction: 'origin' | 'destination',
    userKeyId: string
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }

    logger.info('Updating aggregation...')
    const isNewDataFiltered = await this.isDataIncludedInAggregationVariable(
      aggregationVariable,
      data
    )
    const entityVarDataloader = getDataLoader(data, {
      baseCurrency: aggregationVariable.baseCurrency,
      tenantId: this.tenantId,
      dynamoDb: this.dynamoDb,
    })
    const newDataValue = await entityVarDataloader.load(
      this.getAggregationVarFieldKey(aggregationVariable, direction)
    )
    const hasGroups = Boolean(aggregationVariable.aggregationGroupByFieldKey)
    const newGroupValue = aggregationVariable.aggregationGroupByFieldKey
      ? await entityVarDataloader.load(
          aggregationVariable.aggregationGroupByFieldKey
        )
      : undefined
    if (!isNewDataFiltered || !newDataValue || (hasGroups && !newGroupValue)) {
      return
    }
    const shouldSkipUpdateAggregation =
      await this.aggregationRepository.isTransactionApplied(
        aggregationVariable,
        direction,
        data.transaction.transactionId
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
        data.transaction.timestamp,
        data.transaction.timestamp + 1,
        aggregationGranularity
      )) ?? []
    if ((targetAggregations?.length ?? 0) > 1) {
      throw new Error('Should only get one target aggregation')
    }
    const targetAggregation = targetAggregations?.[0] ?? {
      time: getTransactionStatsTimeGroupLabel(
        data.transaction.timestamp,
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
      data.transaction.transactionId
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
    data: RuleData,
    entityVarDataloader: DataLoader<string, unknown>
  ) {
    const { transaction } = data
    const { aggregationFunc } = aggregationVariable
    const userKeyId = this.getUserKeyId(
      transaction,
      direction,
      aggregationVariable.type
    )
    if (!userKeyId) {
      return null
    }

    const { afterTimestamp, beforeTimestamp } = this.getTimeRange(
      data.transaction.timestamp,
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )

    const aggregationGranularity =
      this.getAggregationGranularity(aggregationVariable)

    let aggData: Array<{ time: string } & AggregationData> = []
    if (this.mode === 'DYNAMODB') {
      // If the mode is DYNAMODB, we fetch the pre-built aggregation data
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
      const rebuiltAggData = await this.getRebuiltAggregationVariableResult(
        aggregationVariable,
        {
          userId:
            direction === 'origin'
              ? data.transaction.originUserId
              : data.transaction.destinationUserId,
          paymentDetails:
            direction === 'origin'
              ? data.transaction.originPaymentDetails
              : data.transaction.destinationPaymentDetails,
        },
        {
          afterTimestamp,
          beforeTimestamp,
        }
      )
      aggData = Object.entries(rebuiltAggData).map(([time, value]) => ({
        time,
        ...value,
      }))
    }
    const aggregator = getRuleVariableAggregator(aggregationFunc)
    const hasGroups = Boolean(aggregationVariable.aggregationGroupByFieldKey)
    const newGroupValue = aggregationVariable.aggregationGroupByFieldKey
      ? ((await entityVarDataloader.load(
          aggregationVariable.aggregationGroupByFieldKey
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

    if (
      aggregationVariable.aggregationFunc !== 'UNIQUE_VALUES' &&
      this.isNewDataWithinTimeWindow(data, afterTimestamp, beforeTimestamp)
    ) {
      const shouldIncludeNewData =
        await this.isDataIncludedInAggregationVariable(
          aggregationVariable,
          data
        )
      if (shouldIncludeNewData) {
        const newDataValue = await entityVarDataloader.load(
          this.getAggregationVarFieldKey(aggregationVariable, direction)
        )
        // NOTE: Merge the incoming transaction/user into the aggregation result
        if (newDataValue) {
          result = aggregator.reduce(result, newDataValue)
        }
      }
    }
    return aggregator.compute(result)
  }

  private async isDataIncludedInAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    data: RuleData
  ) {
    return (
      !aggregationVariable.filtersLogic ||
      (
        await this.evaluate(
          aggregationVariable.filtersLogic,
          [],
          {
            baseCurrency: aggregationVariable.baseCurrency,
            tenantId: this.tenantId,
          },
          data
        )
      ).hit
    )
  }

  private isNewDataWithinTimeWindow(
    data: RuleData,
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
    if (aggregationVariable.timeWindow.end.granularity === 'all_time')
      return 'year'
    else if (aggregationVariable.timeWindow.start.granularity === 'now')
      return aggregationVariable.timeWindow.end.granularity
    return aggregationVariable.timeWindow.start.rollingBasis ||
      aggregationVariable.timeWindow.end.rollingBasis
      ? 'hour'
      : aggregationVariable.timeWindow.start.granularity
  }

  private getTimeRange(
    currentTimestamp: number,
    timeWindowFrom: RuleAggregationTimeWindow,
    timeWindowTo: RuleAggregationTimeWindow
  ) {
    let afterTimestamp: number, beforeTimestamp: number
    if (timeWindowTo.granularity === 'all_time') {
      afterTimestamp = dayjs(currentTimestamp).subtract(5, 'year').valueOf()
    } else {
      afterTimestamp = getTimestampRange(
        currentTimestamp,
        timeWindowFrom as TimeWindow
      ).afterTimestamp
    }
    if (timeWindowTo.granularity === 'now') {
      beforeTimestamp = currentTimestamp
    } else {
      beforeTimestamp = getTimestampRange(
        currentTimestamp,
        timeWindowTo as TimeWindow
      ).afterTimestamp
    }
    return { afterTimestamp, beforeTimestamp }
  }
}
