import { AsyncLogicEngine } from 'json-logic-engine'
import memoizeOne from 'memoize-one'
import DataLoader from 'dataloader'
import {
  cloneDeep,
  get,
  isEqual,
  memoize,
  mergeWith,
  set,
  uniq,
  unset,
} from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import {
  getAllValuesByKey,
  replaceMagicKeyword,
  traverse,
} from '@flagright/lib/utils'
import dayjs from '@flagright/lib/utils/dayjs'
import { RULE_FUNCTIONS } from '../v8-functions'
import { JSON_LOGIC_BUILT_IN_OPERATORS, RULE_OPERATORS } from '../v8-operators'
import {
  VARIABLE_NAMESPACE_SEPARATOR,
  getDirectionalVariableKeys,
  getRuleVariableByKey,
  isDirectionLessVariable,
  isSenderUserVariable,
} from '../v8-variables'
import { getTimestampRange } from '../utils/time-utils'
import { TimeWindow } from '../utils/rule-parameter-schemas'
import { getRuleVariableAggregator } from '../v8-variable-aggregators'
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
  TransactionRuleVariable,
  TransactionRuleVariableContext,
} from '../v8-variables/types'
import { getPaymentDetailsIdentifiersKey } from '../v8-variables/payment-details'
import {
  AggregationData,
  AggregationRepository,
  getAggVarHash,
} from './aggregation-repository'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { generateChecksum } from '@/utils/object'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/User'
import { logger } from '@/core/logger'
import { envIs } from '@/utils/env'
import { handleV8TransactionAggregationTask } from '@/lambdas/transaction-aggregation/app'
import { getSQSClient } from '@/utils/sns-sqs-client'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { RuleAggregationType } from '@/@types/openapi-internal/RuleAggregationType'
import { RuleAggregationTimeWindow } from '@/@types/openapi-internal/RuleAggregationTimeWindow'

const sqs = getSQSClient()

type RuleData = {
  transaction: Transaction
  senderUser?: User | Business
  receiverUser?: User | Business
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
  (data: RuleData, context: TransactionRuleVariableContext) => {
    return new DataLoader(async (variableKeys: readonly string[]) => {
      return Promise.all(
        variableKeys.map(async (variableKey) => {
          const variable = getRuleVariableByKey(variableKey)
          if (!variable) {
            logger.error(`Rule variable not found: ${variableKey}`)
            return null
          }
          if (variable.entity === 'TRANSACTION') {
            return variable.load(data.transaction, context)
          }
          if (
            ['CONSUMER_USER', 'BUSINESS_USER', 'USER'].includes(variable.entity)
          ) {
            const user = isSenderUserVariable(variable)
              ? data.senderUser
              : data.receiverUser
            return user ? variable.load(user, context) : null
          }
          return null
        })
      )
    })
  },
  // Don't take dynamoDb into account
  (a, b) => isEqual(a.slice(0, 2), b.slice(0, 2))
)

function isAggregationVariable(key: string): boolean {
  return key.startsWith('agg:')
}

export function getVariableKeysFromLogic(jsonLogic: object): {
  entityVariableKeys: string[]
  aggVariableKeys: string[]
} {
  const variableKeys = uniq(
    getAllValuesByKey<string>('var', jsonLogic).filter((v) =>
      // NOTE: We don't need to load the subfields of an array-type variable
      v.includes(VARIABLE_NAMESPACE_SEPARATOR)
    )
  )
  const entityVariableKeys = variableKeys.filter(
    (k) => !isAggregationVariable(k)
  )
  const aggVariableKeys = variableKeys.filter(isAggregationVariable)
  return { entityVariableKeys, aggVariableKeys }
}

const OPERATOR_KEYS = new Set(
  JSON_LOGIC_BUILT_IN_OPERATORS.concat(RULE_OPERATORS.map((v) => v.key))
)
export function transformJsonLogic(rawJsonLogic: object) {
  const { entityVariableKeys } = getVariableKeysFromLogic(rawJsonLogic)
  const hasDirectionLessEntityVariables = entityVariableKeys.some(
    isDirectionLessVariable
  )
  if (!hasDirectionLessEntityVariables) {
    return rawJsonLogic
  }
  const updatedLogic = cloneDeep(rawJsonLogic)
  traverse(rawJsonLogic, (key, value, path) => {
    if (key === 'var' && isDirectionLessVariable(value)) {
      const nearestOperatorIndex =
        path.length -
        path
          .slice()
          .reverse()
          .findIndex((v) => OPERATOR_KEYS.has(v)) -
        1
      const leafLogic = cloneDeep(
        get(rawJsonLogic, path.slice(0, nearestOperatorIndex))
      )
      unset(updatedLogic, path.slice(0, nearestOperatorIndex + 1))

      set(
        updatedLogic,
        [...path.slice(0, nearestOperatorIndex), 'or'],
        getDirectionalVariableKeys(value).map((directionVarKey) =>
          replaceMagicKeyword(leafLogic, value, directionVarKey)
        )
      )
    }
  })
  const { entityVariableKeys: newEntityVariableKeys } =
    getVariableKeysFromLogic(updatedLogic)
  const stillHasDirectionLessEntityVariables = newEntityVariableKeys.some(
    isDirectionLessVariable
  )
  // NOTE: Transform one more time if both LHS and RHS are direction-less variables
  return stillHasDirectionLessEntityVariables
    ? transformJsonLogic(updatedLogic)
    : updatedLogic
}

export class RuleJsonLogicEvaluator {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private aggregationRepository: AggregationRepository

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.aggregationRepository = new AggregationRepository(
      this.tenantId,
      this.dynamoDb
    )
  }

  public async evaluate(
    rawJsonLogic: object,
    aggregationVariables: RuleAggregationVariable[],
    context: Omit<TransactionRuleVariableContext, 'dynamoDb'>,
    data: RuleData
  ): Promise<{
    hit: boolean
    varData: Array<{
      [key: string]: unknown
    }>
    hitDirections: RuleHitDirection[]
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
          origin:
            aggVariable.userDirection !== 'RECEIVER' &&
            aggVariable.transactionDirection !== 'RECEIVING'
              ? await aggregationVarLoader.load({
                  direction: 'origin',
                  aggVariable,
                })
              : null,
          destination:
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
    const directions = aggHasBothUserDirections
      ? ['origin', 'destination']
      : ['origin']
    let hit = false
    // NOTE: If there's no aggregation variable, we hit both directions. One side can be muted
    // by setting alertConfig.alertCreationDirection
    const hitDirections: RuleHitDirection[] =
      aggVariables.length > 0 ? [] : ['ORIGIN', 'DESTINATION']
    const varDatas: Array<{ [key: string]: any }> = []
    for (const direction of directions) {
      const aggVarEntries: Array<{
        entry: [string, any]
        direction: RuleHitDirection
      }> = aggVarData.map((v) => {
        const directionToUse =
          v.variable.userDirection === 'SENDER'
            ? 'origin'
            : v.variable.userDirection === 'RECEIVER'
            ? 'destination'
            : direction
        return {
          entry: [v.variable.key, v[directionToUse]],
          direction: directionToUse === 'origin' ? 'ORIGIN' : 'DESTINATION',
        }
      })
      const varData = Object.fromEntries(
        entityVarEntries.concat(aggVarEntries.map((v) => v.entry))
      )
      varDatas.push(varData)
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
      // TODO (V8): Persist varData for both directions
      varData: varDatas,
      hitDirections: hit ? uniq(hitDirections) : [],
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
    logger.info('Rebuilding aggregation...')
    const aggFunc = getRuleVariableAggregator(
      aggregationVariable.aggregationFunc
    )
    const transactionRepository = new DynamoDbTransactionRepository(
      this.tenantId,
      this.dynamoDb
    )
    const { afterTimestamp, beforeTimestamp } = this.getTimeRange(
      ruleData.transaction.timestamp,
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )

    const aggregationGranularity =
      this.getAggregationGranularity(aggregationVariable)

    const fieldsToFetch = this.getTransactionFieldsToFetch(aggregationVariable)
    const generator = getTransactionsGenerator(
      direction == 'origin'
        ? ruleData.transaction.originUserId
        : ruleData.transaction.destinationUserId,
      direction == 'origin'
        ? ruleData.transaction.originPaymentDetails
        : ruleData.transaction.destinationPaymentDetails,
      transactionRepository,
      {
        afterTimestamp,
        beforeTimestamp,
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
      const transactions = data.sendingTransactions.concat(
        data.receivingTransactions
      )

      // Filter transactions by filtersLogic
      const targetTransactions: Transaction[] = []
      for (const transaction of transactions) {
        const isTransactionFiltered =
          await this.isDataIncludedInAggregationVariable(aggregationVariable, {
            transaction: transaction as Transaction,
          })
        if (isTransactionFiltered) {
          targetTransactions.push(transaction as Transaction)
        }
      }
      // Update aggregation result
      const txEntityVariable = getRuleVariableByKey(
        this.getAggregationVarFieldKey(aggregationVariable, direction)
      )
      const partialTimeAggregatedResult = await groupTransactionsByGranularity(
        targetTransactions,
        async (groupTransactions) => {
          const aggregateValues = await Promise.all(
            groupTransactions.map((transaction) => {
              const entityVariable = txEntityVariable
              return entityVariable?.load(
                transaction,
                aggregationVariable.baseCurrency,
                this.dynamoDb
              )
            })
          )
          return {
            value: aggFunc.aggregate(aggregateValues),
          }
        },
        aggregationGranularity
      )
      timeAggregatedResult = mergeWith(
        timeAggregatedResult,
        partialTimeAggregatedResult,
        (a: AggregationData | undefined, b: AggregationData | undefined) => {
          return {
            value: aggFunc.merge(
              a?.value ?? aggFunc.init(),
              b?.value ?? aggFunc.init()
            ),
          }
        }
      )
    }
    await this.aggregationRepository.rebuildUserTimeAggregations(
      userKeyId,
      aggregationVariable,
      timeAggregatedResult
    )
    await this.aggregationRepository.setAggregationVariableReady(
      aggregationVariable,
      userKeyId
    )
    logger.info('Rebuilt aggregation')
  }

  public async updateAggregationVariable(
    aggregationVariable: RuleAggregationVariable,
    data: RuleData,
    direction: 'origin' | 'destination'
  ) {
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
    if (!isNewDataFiltered || !newDataValue) {
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

    const aggFunc = getRuleVariableAggregator(
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
      value: aggFunc.init(),
    }
    const updatedTargetAggregation = aggFunc.reduce(
      targetAggregation.value,
      newDataValue
    )
    await this.aggregationRepository.rebuildUserTimeAggregations(
      userKeyId,
      aggregationVariable,
      { [targetAggregation.time]: { value: updatedTargetAggregation } }
    )
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

    const aggData =
      (await this.aggregationRepository.getUserRuleTimeAggregations(
        userKeyId,
        aggregationVariable,
        afterTimestamp,
        beforeTimestamp,
        aggregationGranularity
      )) ?? []

    const aggFunc = getRuleVariableAggregator(aggregationFunc)
    const result = aggData.reduce((acc, cur) => {
      return aggFunc.merge(acc, cur.value as any)
    }, aggFunc.init())

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
        if (newDataValue) {
          // NOTE: Merge the incoming transaction/user into the aggregation result
          return aggFunc.compute(aggFunc.reduce(result, newDataValue))
        }
      }
    }
    return aggFunc.compute(result)
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
