import { AsyncLogicEngine } from 'json-logic-engine'
import memoizeOne from 'memoize-one'
import type { MemoizedFunction } from 'lodash'
import compact from 'lodash/compact'
import drop from 'lodash/drop'
import find from 'lodash/find'
import groupBy from 'lodash/groupBy'
import isEmpty from 'lodash/isEmpty'
import isEqual from 'lodash/isEqual'
import isUndefined from 'lodash/isUndefined'
import last from 'lodash/last'
import mapValues from 'lodash/mapValues'
import memoize from 'lodash/memoize'
import mergeWith from 'lodash/mergeWith'
import minBy from 'lodash/minBy'
import omit from 'lodash/omit'
import omitBy from 'lodash/omitBy'
import size from 'lodash/size'
import sortBy from 'lodash/sortBy'
import uniq from 'lodash/uniq'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { INTERNAL_LOGIC_FUNCTIONS, LOGIC_FUNCTIONS } from '../functions'
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
  UserLogicVariable,
} from '../variables/types'
import { getPaymentDetailsIdentifiersKey } from '../variables/payment-details'
import { CUSTOM_INTERNAL_OPERATORS, LOGIC_OPERATORS } from '../operators'
import {
  AggregationData,
  AggregationRepository,
  BulkApplyMarkerTransactionData,
  BulkApplyMarkerUserData,
  getAggVarHash,
} from './aggregation-repository'
import {
  canAggregate,
  getAggregationGranularity,
  getUserKeyId,
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
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { batchWrite, BatchWriteRequestInternal } from '@/utils/dynamodb'
import { addNewSubsegment, traceable } from '@/core/xray'
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
import {
  getTimeRangeByTimeWindows,
  subtractTime,
} from '@/services/rules-engine/utils/time-utils'
import { TimeWindow } from '@/@types/rule/params'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { LogicEntityVariableEntityEnum } from '@/@types/openapi-internal/LogicEntityVariable'
import { LogicEntityVariableInUse } from '@/@types/openapi-internal/LogicEntityVariableInUse'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { ExecutedLogicVars } from '@/@types/openapi-internal/ExecutedLogicVars'
import { LogicConfig } from '@/@types/openapi-internal/LogicConfig'
import { Tag } from '@/@types/openapi-public/Tag'
import { acquireLock, releaseLock } from '@/utils/lock'
import dayjs from '@/utils/dayjs'
import {
  getUserEventsGenerator,
  groupUsersByGranularity,
  isBusinessUser,
  isConsumerUser,
} from '@/services/rules-engine/utils/user-rule-utils'
import {
  AuxiliaryIndexUserEvent,
  UserEvent,
  UserEventAttributes,
} from '@/services/rules-engine/repositories/user-repository-interface'
import { EntityData, TimestampSlice } from '@/@types/tranasction/aggregation'
import {
  getPaymentDetailsName,
  getPaymentEmailId,
  getPaymentMethodAddress,
} from '@/utils/payment-details'
import { formatConsumerName, getAddressString } from '@/utils/helpers'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
class RebuildSyncRetryError extends Error {
  constructor() {
    super()
    this.name = 'RebuildSyncRetryError'
  }
}

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
  userEvent?: UserEvent
}
export type LogicData = TransactionLogicData | UserLogicData

type UserIdentifier = {
  userId?: string
  paymentDetails?: PaymentDetails
  entityData?: EntityData
}

type EntityVariableWithoutName = Omit<LogicEntityVariableInUse, 'name'>

export type AuxiliaryIndexTransactionWithDirection =
  AuxiliaryIndexTransaction & {
    direction?: 'origin' | 'destination'
  }
export type AuxiliaryIndexTransactionDataWithDirection = {
  transaction: AuxiliaryIndexTransactionWithDirection
  lastTxEvent?: TransactionEventWithRulesResult
}
const TRANSACTION_EVENT_ENTITY_VARIABLE_TYPE: LogicEntityVariableEntityEnum =
  'TRANSACTION_EVENT'

export const getJsonLogicEngine = memoizeOne(
  (context?: { tenantId: string; dynamoDb: DynamoDBDocumentClient }) => {
    const jsonLogicEngine = new AsyncLogicEngine()
    const runContext = {
      engine: jsonLogicEngine,
    }
    LOGIC_FUNCTIONS.concat(INTERNAL_LOGIC_FUNCTIONS)
      .filter((v) => v.run)
      .forEach((v) => jsonLogicEngine.addMethod(v.key, v.run))
    CUSTOM_INTERNAL_OPERATORS.concat(LOGIC_OPERATORS).forEach((v) => {
      jsonLogicEngine.addMethod(v.key, {
        traverse: v.traverse,
        deterministic: v.deterministic,
        asyncMethod: memoize(
          (values, executionContext) => {
            const cardinality = v.uiDefinition.cardinality ?? 1
            const lhs = values[0]
            const rhs = values.slice(1, cardinality + 1)
            const parameters = values[cardinality + 1]
            return v.run(
              lhs,
              rhs.length === 1 ? rhs[0] : rhs,
              parameters,
              context,
              {
                ...runContext,
                executionContext,
              }
            )
          },
          (values, executionContext) =>
            generateChecksum({ values, executionContext })
        ),
      })
    })
    return jsonLogicEngine
  },
  isEqual
)

function getEntityVariableLoaderKey(
  entityVariable: LogicEntityVariableInUse
): EntityVariableWithoutName {
  const { filtersLogic } = entityVariable
  return {
    key: entityVariable.key,
    entityKey: entityVariable.entityKey,
    filtersLogic: isEmpty(filtersLogic) ? undefined : filtersLogic,
  }
}

type Mode = 'MONGODB' | 'DYNAMODB'

@traceable
export class LogicEvaluator {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private aggregationRepository: AggregationRepository
  private userRepository: UserRepository
  private mode: Mode
  private transactionEventRepository?: TransactionEventRepository
  private backfillNamespace: string | undefined
  private aggregationDynamoTable: string

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
    // Warning: we are need dynamo db connection here because getUser function fetches user from dynamo
    this.userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    this.mode = mode
    this.aggregationDynamoTable =
      tenantId === '4c9cdf0251'
        ? StackConstants.AGGREGATION_DYNAMODB_TABLE_NAME
        : StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  }

  public setBackfillNamespace(backfillNamespace: string | undefined) {
    this.backfillNamespace = backfillNamespace
    this.aggregationRepository.setBackfillNamespace(backfillNamespace)
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
    const lambdaContext = getContext()
    const traceNamespace = `${
      lambdaContext?.metricDimensions?.ruleInstanceId ??
      lambdaContext?.metricDimensions?.riskFactorId
    }`
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
          await entityVarDataloader(getEntityVariableLoaderKey(variable)),
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
        const aggregationVarLoaderUser =
          data.type === 'USER' ? this.aggregationVarLoaderUser(data) : null
        if (aggVariable.type === 'USER_DETAILS') {
          return {
            variable: aggVariable,
            ORIGIN: aggregationVarLoaderUser
              ? await aggregationVarLoaderUser({ aggVariable })
              : null,
            DESTINATION: aggregationVarLoaderUser
              ? await aggregationVarLoaderUser({ aggVariable })
              : null,
          }
        } else {
          return {
            variable: aggVariable,
            ORIGIN:
              aggVariable.userDirection !== 'RECEIVER'
                ? await aggregationVarLoader({
                    direction: 'origin',
                    aggVariable,
                  })
                : null,
            DESTINATION:
              aggVariable.userDirection !== 'SENDER'
                ? await aggregationVarLoader({
                    direction: 'destination',
                    aggVariable,
                  })
                : null,
          }
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
      return memoize(
        async (entityVariable: EntityVariableWithoutName) => {
          const variable = getLogicVariableByKey(
            entityVariable.entityKey ?? entityVariable.key
          )
          if (!variable) {
            logger.error(`Rule variable not found: ${entityVariable.entityKey}`)
            return null
          }
          if (
            variable.entity === 'TRANSACTION' &&
            data.type === 'TRANSACTION'
          ) {
            let transaction: Transaction | undefined = data.transaction
            if (!isEmpty(entityVariable.filtersLogic)) {
              const targetTransactionEvent = await this.findTransactionEvent(
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
              const targetTransactionEvent = await this.findTransactionEvent(
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

          let user =
            data.type === 'TRANSACTION'
              ? isSenderUserVariable(variable.key)
                ? data.senderUser
                : data.receiverUser
              : data.user

          // if the user is null we can try fetching this user from db, because we don't send sender and receiver user
          // while evalutating aggregation/entity filters
          const userId =
            data.type === 'TRANSACTION'
              ? isSenderUserVariable(variable.key)
                ? data.transaction.originUserId
                : data.transaction.destinationUserId
              : undefined

          if (!user) {
            if (!userId) {
              return null
            }
            user = await this.userRepository.getUser<User | Business>(userId)
            if (!user) {
              return null
            }
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
        },
        (entityVariable) => generateChecksum(entityVariable)
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
      return memoize(
        async ({ direction, aggVariable }) => {
          for (let i = 0; i < 2; i++) {
            try {
              return await this.loadAggregationData(
                direction,
                aggVariable,
                data
              )
            } catch (e) {
              if (e instanceof RebuildSyncRetryError) {
                // try one more time after the rebuild is done
                if (i === 0) {
                  continue
                }
                logger.error('Still get RebuildSyncRetryError after rebuild')
                return null
              }
              throw e
            }
          }
        },
        ({ direction, aggVariable }) => {
          return `${direction}-${getAggVarHash(aggVariable)}`
        }
      )
    },
    (a, b) => isEqual(a[0], b[0])
  )
  private aggregationVarLoaderUser = memoizeOne(
    (data: UserLogicData) => {
      return memoize(
        async ({ aggVariable }) => {
          for (let i = 0; i < 2; i++) {
            try {
              return await this.loadAggregationDataUser(aggVariable, data)
            } catch (e) {
              if (e instanceof RebuildSyncRetryError) {
                // try one more time after the rebuild is done
                if (i === 0) {
                  continue
                }
                logger.error('Still get RebuildSyncRetryError after rebuild')
                return null
              }
              throw e
            }
          }
        },
        ({ aggVariable }) => {
          return `${getAggVarHash(aggVariable)}`
        }
      )
    },
    (a, b) => isEqual(a[0], b[0])
  )

  private isTransactionApplied = memoize(
    async (
      aggregationVariable: LogicAggregationVariable,
      direction: 'origin' | 'destination',
      transaction: Transaction
    ): Promise<boolean> => {
      if (this.mode !== 'DYNAMODB') {
        return false
      }
      const isTransactionApplied =
        await this.aggregationRepository.isTransactionApplied(
          aggregationVariable,
          direction,
          transaction.transactionId
        )

      return isTransactionApplied
    },
    (aggregationVariable, direction, transaction) =>
      `${getAggVarHash(aggregationVariable)}-${direction}-${
        transaction.transactionId
      }`
  )

  private isUserEventApplied = memoize(
    async (
      aggregationVariable: LogicAggregationVariable,
      eventId: string
    ): Promise<boolean> => {
      if (this.mode !== 'DYNAMODB') {
        return false
      }
      const isUserEventApplied =
        await this.aggregationRepository.isUserEventApplied(
          aggregationVariable,
          eventId
        )

      return isUserEventApplied
    },
    (aggregationVariable, eventId) =>
      `${getAggVarHash(aggregationVariable)}-${eventId}`
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

    const userKeyId = getUserKeyId(
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
        : transaction.destinationPaymentDetails,
      this.getEntityData(
        aggregationVariable,
        direction === 'origin'
          ? transaction.originPaymentDetails
          : transaction.destinationPaymentDetails
      )
    )

    await this.updateAggregationVariableInternalIfNeeded(
      aggregationVariable,
      data,
      direction,
      userKeyId
    )
  }
  public async rebuildOrUpdateUserAggregationVariable(
    aggregationVariable: LogicAggregationVariable,
    data: UserLogicData
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }
    const { user } = data

    const userKeyId = user.userId
    if (!userKeyId) {
      return
    }
    const userType = isBusinessUser(user as User | Business)
    await this.rebuildUserAggregationVariable(
      aggregationVariable,
      data.userEvent?.timestamp ?? Date.now(),
      user.userId,
      !userType
    )

    await this.updateUserAggregationVariableInternalIfNeeded(
      aggregationVariable,
      data,
      userKeyId
    )
  }

  private getEntityData(
    aggregationVariable: LogicAggregationVariable,
    paymentDetails: PaymentDetails | undefined
  ): EntityData | undefined {
    switch (aggregationVariable.type) {
      case 'PAYMENT_DETAILS_NAME': {
        const name = getPaymentDetailsName(paymentDetails)
        return name ? { type: 'NAME', name } : undefined
      }
      case 'PAYMENT_DETAILS_EMAIL': {
        const email = getPaymentEmailId(paymentDetails)
        return email ? { type: 'EMAIL', email } : undefined
      }
      case 'PAYMENT_DETAILS_ADDRESS': {
        const address = getPaymentMethodAddress(paymentDetails)
        return address ? { type: 'ADDRESS', address } : undefined
      }
      default:
        return undefined
    }
  }

  public async rebuildAggregationVariable(
    aggregationVariable: LogicAggregationVariable,
    currentTimestamp: number,
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    entityData: EntityData | undefined,
    timeRange?: TimestampSlice,
    totalTimeSlices?: number
  ): Promise<boolean> {
    let userKeyId: string | undefined
    switch (aggregationVariable.type) {
      case 'USER_TRANSACTIONS':
        userKeyId = userId
        break
      case 'PAYMENT_DETAILS_TRANSACTIONS':
        userKeyId =
          paymentDetails && getPaymentDetailsIdentifiersKey(paymentDetails)
        break
      case 'PAYMENT_DETAILS_ADDRESS': {
        userKeyId =
          entityData?.type === 'ADDRESS'
            ? getAddressString(entityData.address)
            : undefined
        break
      }
      case 'PAYMENT_DETAILS_EMAIL':
        userKeyId = entityData?.type === 'EMAIL' ? entityData.email : undefined
        break
      case 'PAYMENT_DETAILS_NAME':
        userKeyId =
          entityData?.type === 'NAME'
            ? typeof entityData.name === 'string'
              ? entityData.name
              : formatConsumerName(entityData.name)
            : undefined
        break

      case 'USER_DETAILS':
        return false
    }

    if (this.mode !== 'DYNAMODB' || !userKeyId) {
      return false
    }

    const { ready } =
      await this.aggregationRepository.isAggregationVariableReady(
        aggregationVariable,
        userKeyId
      )
    if (ready) {
      return false
    }

    logger.debug('Rebuilding aggregation...')
    const { afterTimestamp } = getTimeRangeByTimeWindows(
      currentTimestamp,
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )
    const aggregationTimeRange = timeRange
      ? {
          afterTimestamp: timeRange.startTimestamp,
          beforeTimestamp: timeRange.endTimestamp,
        }
      : { afterTimestamp, beforeTimestamp: currentTimestamp }

    const {
      result: aggregationResult,
      lastTransactionTimestamp,
      applyMarkerTransactionData,
    } = await this.getRebuiltAggregationVariableResult(
      aggregationVariable,
      { userId, paymentDetails, entityData },
      aggregationTimeRange,
      currentTimestamp
    )

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
      logger.debug(`Saving aggregation for ${groups.length} groups`)
      await batchWrite(
        this.dynamoDb,
        writeRequests,
        this.aggregationDynamoTable
      )
    } else {
      await this.aggregationRepository.rebuildUserTimeAggregations(
        userKeyId,
        aggregationVariable,
        aggregationResult,
        undefined
      )
    }
    await this.aggregationRepository.bulkMarkTransactionApplied(
      aggregationVariable,
      applyMarkerTransactionData
    )
    await this.aggregationRepository.setAggregationVariableReady(
      aggregationVariable,
      userKeyId,
      lastTransactionTimestamp,
      totalTimeSlices,
      hasFeature('RULES_ENGINE_V8_SYNC_REBUILD') && !totalTimeSlices,
      timeRange?.sliceNumber
    )
    logger.debug('Rebuilt aggregation for time window', timeRange)
    return true
  }
  public async rebuildUserAggregationVariable(
    aggregationVariable: LogicAggregationVariable,
    currentTimestamp: number,
    userId: string,
    isConsumer?: boolean
  ): Promise<boolean> {
    const userKeyId =
      aggregationVariable.type === 'USER_DETAILS' ? userId : undefined

    if (this.mode !== 'DYNAMODB' || !userKeyId) {
      return false
    }

    const { ready } =
      await this.aggregationRepository.isAggregationVariableReady(
        aggregationVariable,
        userKeyId
      )
    if (ready) {
      return false
    }

    logger.debug('Rebuilding aggregation...')
    const { afterTimestamp } = getTimeRangeByTimeWindows(
      currentTimestamp,
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )
    const {
      result: aggregationResult,
      lastTransactionTimestamp,
      applyMarkerUserData,
    } = await this.getRebuiltUserAggregationVariableResult(
      aggregationVariable,
      userId,
      {
        afterTimestamp,
        beforeTimestamp: currentTimestamp,
      },
      isConsumer
    )
    logger.debug('Prepared rebuild result')
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
      logger.debug(`Saving aggregation for ${groups.length} groups`)
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
    await this.aggregationRepository.bulkMarkUserEventApplied(
      aggregationVariable,
      applyMarkerUserData
    )
    await this.aggregationRepository.setUserAggregationVariableReady(
      aggregationVariable,
      userKeyId,
      lastTransactionTimestamp
    )
    logger.debug('Rebuilt aggregation')
    return true
  }

  private async getRebuiltAggregationVariableResult(
    aggregationVariable: LogicAggregationVariable,
    userIdentifier: UserIdentifier,
    timeRange: { afterTimestamp: number; beforeTimestamp: number },
    currentTimestamp?: number
  ): Promise<{
    result: { [time: string]: AggregationData }
    lastTransactionTimestamp: number
    applyMarkerTransactionData: BulkApplyMarkerTransactionData
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
            await getMongoDbClient(),
            this.dynamoDb
          )

    const generator = getTransactionsGenerator(
      userIdentifier.userId,
      userIdentifier.paymentDetails,
      userIdentifier.entityData,
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

    const threeDaysBeforeTimestamp = subtractTime(
      dayjs(currentTimestamp ?? timeRange.beforeTimestamp),
      {
        granularity: 'day',
        units: 3,
      }
    )
    const applyMarkerTransactionData: BulkApplyMarkerTransactionData = []
    // NOTE: As we're still using lambda to rebuild aggregation, there's a hard 15 minuites timeout.
    // As we support 'all time' time window, it's possible that it takes more than 15 minutes to rebuild as
    // we need to fetch all the transaction of a user.
    // For now, as a workaround, we stop fetching transactions if the timeout is reached to avoid repeatedly
    // retrying to rebuild and fail.
    // TODO: Proper fix by FR-5225
    const isFargate = process.env.AWS_LAMBDA_FUNCTION_NAME == null
    let timeoutReached = false
    let timeout: NodeJS.Timeout | undefined

    if (!isFargate) {
      timeout = setTimeout(() => {
        timeoutReached = true
      }, 10 * 60 * 1000)
    }

    let timeAggregatedResult: {
      [time: string]: AggregationData
    } = {}

    let targetTransactionsCount = 0
    const entitiesByGroupValue: { [key: string]: number } = {}
    let lastTransactionTimestamp = 0
    for await (const data of generator || []) {
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
      const targetTransactionData: AuxiliaryIndexTransactionDataWithDirection[] =
        []
      for (const transaction of transactions) {
        const senderUser = userFilterDirections.has('sender')
          ? await this.userLoader(transaction.originUserId)
          : undefined
        const receiverUser = userFilterDirections.has('receiver')
          ? await this.userLoader(transaction.destinationUserId)
          : undefined
        const data: LogicData = {
          type: 'TRANSACTION',
          transaction: transaction as TransactionWithRiskDetails,
          transactionEvents: [],
          senderUser,
          receiverUser,
        }
        const isTransactionFiltered =
          await this.isDataIncludedInAggregationVariable(
            aggregationVariable,
            data
          )
        if (isTransactionFiltered) {
          targetTransactionsCount++
          targetTransactionData.push({
            transaction: transaction,
            lastTxEvent: data.transactionEvents?.[0],
          })
          if (
            (transaction.timestamp ?? 0) >= threeDaysBeforeTimestamp &&
            transaction.transactionId &&
            transaction.direction
          ) {
            /*
            To use only transaction applied marker to check if transaction is applied,
            Note: Only marking last 3 days transaction in the rebuild which are applied.
             */

            applyMarkerTransactionData.push({
              transactionId: transaction.transactionId,
              direction: transaction.direction,
            })
          }
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
        baseCurrency: aggregationVariable.baseCurrency as
          | CurrencyCode
          | 'ORIGINAL_CURRENCY',
        dynamoDb: this.dynamoDb,
        tenantId: this.tenantId,
      }
      const hasGroups = Boolean(txGroupByEntityVariable)
      const partialTimeAggregatedResult = await groupTransactionsByGranularity(
        targetTransactionData,
        async (groupTransactions) => {
          const aggregateValues = await Promise.all(
            groupTransactions.map(
              async (
                transactionData: AuxiliaryIndexTransactionDataWithDirection
              ) => {
                const { transaction, lastTxEvent } = transactionData
                const timestampToUse = aggregationVariable.useEventTimestamp
                  ? lastTxEvent?.timestamp ?? transaction.timestamp
                  : transaction.timestamp
                // TODO: support tx event for aggregation variable
                const entityVariable =
                  transaction.direction === 'origin'
                    ? sendingTxEntityVariable
                    : receivingTxEntityVariable
                let value = await entityVariable?.load(transaction, context)
                if (
                  aggregationVariable.aggregationFilterFieldKey &&
                  aggregationVariable.aggregationFilterFieldValue &&
                  value
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
                      timestamp: timestampToUse,
                      value,
                    },
                  },
                  ...(!hasGroups
                    ? {
                        entity: {
                          timestamp: timestampToUse,
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
        logger.error(
          `Timeout reached while rebuilding aggregation, for timeWindow: ${timeRange}`
        )
        break
      }
    }

    if (timeout) {
      clearTimeout(timeout)
    }

    return {
      result: timeAggregatedResult,
      lastTransactionTimestamp,
      applyMarkerTransactionData,
    }
  }
  private async getRebuiltUserAggregationVariableResult(
    aggregationVariable: LogicAggregationVariable,
    userId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number },
    isConsumer?: boolean
  ): Promise<{
    result: { [time: string]: AggregationData }
    lastTransactionTimestamp: number
    applyMarkerUserData: BulkApplyMarkerUserData
  }> {
    const userRepository = new UserRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    let user
    if (isConsumer === undefined) {
      user =
        ((await userRepository.getConsumerUser(userId)) as User) ??
        ((await userRepository.getBusinessUser(userId)) as Business)
    } else if (isConsumer) {
      user = (await userRepository.getConsumerUser(userId)) as User
    } else {
      user = (await userRepository.getBusinessUser(userId)) as Business
    }
    isConsumer = isConsumerUser(user)
    const aggregator = getLogicVariableAggregator(
      aggregationVariable.aggregationFunc
    )

    const aggregationGranularity = getAggregationGranularity(
      aggregationVariable.timeWindow,
      this.tenantId
    )
    const fieldsToFetch = this.getUserEventsFieldsToFetch(aggregationVariable)
    const generator = getUserEventsGenerator(
      userId,
      userRepository, // TODO update
      {
        afterTimestamp: timeRange.afterTimestamp,
        beforeTimestamp: timeRange.beforeTimestamp,
        filters: {},
      },
      fieldsToFetch as Array<UserEventAttributes>,
      isConsumer
    )

    const threeDaysBeforeTimestamp = subtractTime(
      dayjs(timeRange.beforeTimestamp),
      {
        granularity: 'day',
        units: 3,
      }
    )
    const applyMarkerUserData: BulkApplyMarkerUserData = []
    // NOTE: As we're still using lambda to rebuild aggregation, there's a hard 15 minuites timeout.
    // As we support 'all time' time window, it's possible that it takes more than 15 minutes to rebuild as
    // we need to fetch all the transaction of a user.
    // For now, as a workaround, we stop fetching transactions if the timeout is reached to avoid repeatedly
    // retrying to rebuild and fail.
    // TODO: Proper fix by FR-5225
    const isFargate = process.env.AWS_FUNCTION_NAME == null
    let timeoutReached = false
    let timeout: NodeJS.Timeout | undefined

    if (!isFargate) {
      timeout = setTimeout(() => {
        timeoutReached = true
      }, 10 * 60 * 1000)
    }

    let timeAggregatedResult: {
      [time: string]: AggregationData
    } = {}

    let targetUsersCount = 0
    const entitiesByGroupValue: { [key: string]: number } = {}
    const lastTransactionTimestamp = 0
    for await (const data of generator) {
      const userEvents: AuxiliaryIndexUserEvent[] = data.userEvents

      // Filter events by filtersLogic
      const targetUsers: AuxiliaryIndexUserEvent[] = []
      for (const userEvent of userEvents) {
        const isUserFiltered = await this.isDataIncludedInAggregationVariable(
          aggregationVariable,
          {
            type: 'USER',
            user: isConsumer ? (user as User) : (user as Business),
            userEvent: userEvent,
          }
        )
        if (isUserFiltered) {
          targetUsersCount++
          targetUsers.push(userEvent)
          if (
            (userEvent.timestamp ?? 0) >= threeDaysBeforeTimestamp &&
            userEvent.userId &&
            userEvent.userKeyId
          ) {
            applyMarkerUserData.push({
              userId: userEvent.userId ?? '',
            })
          }
          if (
            !aggregationVariable.aggregationGroupByFieldKey &&
            aggregationVariable.lastNEntities &&
            targetUsersCount === aggregationVariable.lastNEntities
          ) {
            break
          }
        }
      }
      // Update aggregation result
      const userEntityVariableKey = aggregationVariable.aggregationFieldKey
      const userEntityVariable = getLogicVariableByKey(userEntityVariableKey)
      if (!userEntityVariable) {
        logger.error('User entity variable not found', userEntityVariableKey)
        break
      }
      const userGroupByEntityVariable =
        aggregationVariable.aggregationGroupByFieldKey
          ? (getLogicVariableByKey(
              aggregationVariable.aggregationGroupByFieldKey
            ) as UserLogicVariable)
          : undefined
      const context: LogicVariableContext = {
        baseCurrency: aggregationVariable.baseCurrency as
          | CurrencyCode
          | 'ORIGINAL_CURRENCY',
        dynamoDb: this.dynamoDb,
        tenantId: this.tenantId,
      }
      const hasGroups = Boolean(userGroupByEntityVariable)
      const partialTimeAggregatedResult = await groupUsersByGranularity(
        targetUsers,
        async (groupUsers) => {
          const aggregateValues = await Promise.all(
            groupUsers.map(async (userEvent: AuxiliaryIndexUserEvent) => {
              let value = await userEntityVariable.load(userEvent, context)
              if (
                aggregationVariable.aggregationFilterFieldKey &&
                aggregationVariable.aggregationFilterFieldValue &&
                value
              ) {
                value = (value as { [key: string]: unknown }[])
                  .filter(
                    (v) =>
                      v.key === aggregationVariable.aggregationFilterFieldValue
                  )
                  ?.map((v) => v.value)
              }
              const groupValue =
                hasGroups && userGroupByEntityVariable
                  ? await userGroupByEntityVariable.load(userEvent, context)
                  : undefined

              return {
                value,
                groupValue: {
                  value: groupValue,
                  entity: {
                    timestamp: userEvent.timestamp,
                    value,
                  },
                },
                ...(!hasGroups
                  ? {
                      entity: {
                        timestamp: userEvent.timestamp,
                        value,
                      },
                    }
                  : {}),
              }
            })
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
        targetUsersCount === aggregationVariable.lastNEntities
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

    if (timeout) {
      clearTimeout(timeout)
    }

    return {
      result: timeAggregatedResult,
      lastTransactionTimestamp,
      applyMarkerUserData,
    }
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
        const userKeyId = getUserKeyId(
          transaction,
          direction,
          aggregationVariable.type
        )
        if (!userKeyId) {
          return
        }
        if (options?.skipIfNotReady) {
          const [{ ready }, isApplied] = await Promise.all([
            this.aggregationRepository.isAggregationVariableReady(
              aggregationVariable,
              userKeyId
            ),
            this.aggregationRepository.isTransactionApplied(
              aggregationVariable,
              direction,
              transaction.transactionId
            ),
          ])
          if (!ready || isApplied) {
            return
          }
        }
        await this.updateAggregationVariableInternalIfNeeded(
          aggregationVariable,
          data,
          direction,
          userKeyId
        )
      })
    )
  }

  public async updateUserAggregationVariable(
    aggregationVariable: LogicAggregationVariable,
    data: UserLogicData
  ) {
    const { user } = data
    const userKeyId = user.userId

    if (!userKeyId) {
      return
    }

    await this.updateUserAggregationVariableInternalIfNeeded(
      aggregationVariable,
      data,
      userKeyId
    )
  }

  private async updateAggregationVariableInternalIfNeeded(
    aggregationVariable: LogicAggregationVariable,
    data: TransactionLogicData,
    direction: 'origin' | 'destination',
    userKeyId: string
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }
    const isNewDataFiltered = await this.isDataIncludedInAggregationVariable(
      aggregationVariable,
      data
    )
    const entityVarDataloader = this.entityVarLoader(data, {
      baseCurrency: aggregationVariable.baseCurrency as
        | CurrencyCode
        | 'ORIGINAL_CURRENCY',
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
      ? await entityVarDataloader({
          key: aggregationVariable.aggregationGroupByFieldKey,
          entityKey: aggregationVariable.aggregationGroupByFieldKey,
        })
      : undefined
    if (!isNewDataFiltered || !newDataValue || (hasGroups && !newGroupValue)) {
      return
    }

    const { transaction } = data
    // Acquire lock before updating the aggregation data to avoid double-counting issue
    // when multiple events are processed at the same time.
    /* Lock based on direction to release the lock faster for next transaction event,
    rather than just transaction as previous transactions
     */
    const lockKey = generateChecksum(
      `agg:${transaction.transactionId}-${getAggVarHash(
        aggregationVariable
      )}-${direction}`
    )

    await acquireLock(this.dynamoDb, lockKey, {
      startingDelay: 100,
      maxDelay: 5000,
      ttlSeconds: 15,
    })
    await this.updateAggregationVariableInternal(
      aggregationVariable,
      data,
      direction,
      userKeyId,
      {
        newGroupValue,
        newDataValue,
      }
    )

    await releaseLock(this.dynamoDb, lockKey)
  }

  private async updateUserAggregationVariableInternalIfNeeded(
    aggregationVariable: LogicAggregationVariable,
    data: UserLogicData,
    userKeyId: string
  ) {
    if (this.mode !== 'DYNAMODB') {
      return
    }
    const isNewDataFiltered = await this.isDataIncludedInAggregationVariable(
      aggregationVariable,
      data
    )
    const entityVarDataloader = this.entityVarLoader(data, {
      baseCurrency: aggregationVariable.baseCurrency as
        | CurrencyCode
        | 'ORIGINAL_CURRENCY',
      tenantId: this.tenantId,
      dynamoDb: this.dynamoDb,
    })
    const newDataValue = await this.getNewDataValueForAggregation(
      aggregationVariable,
      entityVarDataloader
    )
    const hasGroups = Boolean(aggregationVariable.aggregationGroupByFieldKey)
    const newGroupValue = aggregationVariable.aggregationGroupByFieldKey
      ? await entityVarDataloader({
          key: aggregationVariable.aggregationGroupByFieldKey,
          entityKey: aggregationVariable.aggregationGroupByFieldKey,
        })
      : undefined
    if (!isNewDataFiltered || !newDataValue || (hasGroups && !newGroupValue)) {
      return
    }
    await this.updateUserAggregationVariableInternal(
      aggregationVariable,
      data,
      userKeyId,
      {
        newGroupValue,
        newDataValue,
      }
    )
  }
  private async updateAggregationVariableInternal(
    aggregationVariable: LogicAggregationVariable,
    data: TransactionLogicData,
    direction: 'origin' | 'destination',
    userKeyId: string,
    newData: {
      newGroupValue?: any
      newDataValue?: any
    }
  ) {
    const { transaction, transactionEvents } = data
    const timestampToUse = aggregationVariable.useEventTimestamp
      ? last(transactionEvents)?.timestamp ?? transaction.timestamp
      : transaction.timestamp
    const shouldSkipUpdateAggregation = await this.isTransactionApplied(
      aggregationVariable,
      direction,
      transaction
    )
    if (shouldSkipUpdateAggregation) {
      logger.warn(
        `Skip updating aggregations for user:${userKeyId} for aggvarKey: ${aggregationVariable.key}.`
      )
      return
    }

    logger.debug('Updating aggregation...')
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
          timestampToUse + 1,
          aggregationGranularity,
          newData.newGroupValue
        )
      const entitiesCountInAggregation =
        aggregations?.reduce(
          (acc, curr) => (curr?.entities ?? []).length + acc,
          1
        ) ?? 1
      const groupLabel = getTransactionStatsTimeGroupLabel(
        timestampToUse,
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
          timestampToUse,
          timestampToUse + 1,
          aggregationGranularity,
          newData.newGroupValue
        )
      if (size(targetAggregations) > 1) {
        throw new Error('Should only get one target aggregation')
      }
      targetAggregation = targetAggregations?.[0]
    }

    targetAggregation = targetAggregation ?? {
      time: getTransactionStatsTimeGroupLabel(
        timestampToUse,
        aggregationGranularity
      ),
      value: aggregator.init(),
    }

    const newTargetAggregation: AggregationData = {
      value: aggregator.reduce(targetAggregation.value, newData.newDataValue),
    }

    if (aggregationVariable.lastNEntities) {
      newTargetAggregation.entities = (targetAggregation.entities ?? []).concat(
        {
          timestamp: timestampToUse,
          value: newData.newDataValue,
        }
      )
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
        newData.newGroupValue
      )
    }
    await this.aggregationRepository.setTransactionApplied(
      aggregationVariable,
      direction,
      transaction.transactionId
    )
    logger.debug('Updated aggregation')
  }

  private async updateUserAggregationVariableInternal(
    aggregationVariable: LogicAggregationVariable,
    data: UserLogicData,
    userKeyId: string,
    newData: {
      newGroupValue?: any
      newDataValue?: any
    }
  ) {
    const { userEvent } = data
    if (!userEvent) {
      return
    }
    const shouldSkipUpdateAggregation = await this.isUserEventApplied(
      aggregationVariable,
      userEvent?.eventId ?? ''
    )
    if (shouldSkipUpdateAggregation) {
      logger.warn(
        `Skip updating aggregations for user:${userKeyId} for aggvarKey: ${aggregationVariable.key}.`
      )
      return
    }

    logger.debug('Updating aggregation...')
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
          userEvent.timestamp,
          userEvent.timestamp + 1,
          aggregationGranularity,
          newData.newGroupValue
        )
      const entitiesCountInAggregation =
        aggregations?.reduce(
          (acc, curr) => (curr?.entities ?? []).length + acc,
          1
        ) ?? 1
      const groupLabel = getTransactionStatsTimeGroupLabel(
        userEvent.timestamp,
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
          userEvent.timestamp,
          userEvent.timestamp + 1,
          aggregationGranularity,
          newData.newGroupValue
        )
      if (size(targetAggregations) > 1) {
        throw new Error('Should only get one target aggregation')
      }
      targetAggregation = targetAggregations?.[0]
    }

    targetAggregation = targetAggregation ?? {
      time: getTransactionStatsTimeGroupLabel(
        userEvent.timestamp,
        aggregationGranularity
      ),
      value: aggregator.init(),
    }

    const newTargetAggregation: AggregationData = {
      value: aggregator.reduce(targetAggregation.value, newData.newDataValue),
    }

    if (aggregationVariable.lastNEntities) {
      newTargetAggregation.entities = (targetAggregation.entities ?? []).concat(
        {
          timestamp: userEvent.timestamp,
          value: newData.newDataValue,
        }
      )
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
        newData.newGroupValue
      )
    }
    await this.aggregationRepository.setUserEventApplied(
      aggregationVariable,
      userEvent?.eventId ?? ''
    )
    logger.debug('Updated user aggregation')
  }

  private async getNewDataValueForAggregation(
    aggregationVariable: LogicAggregationVariable,
    entityVarDataloader: ((
      entityVariable: EntityVariableWithoutName
    ) => Promise<any>) &
      MemoizedFunction,
    direction: 'origin' | 'destination' = 'origin'
  ) {
    const { aggregationFilterFieldValue, aggregationFilterFieldKey } =
      aggregationVariable
    const aggFieldKey = this.getAggregationVarFieldKey(
      aggregationVariable,
      direction
    )
    const newDataValue = await entityVarDataloader(
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
      'transactionId',
    ])
  }
  private getUserEventsFieldsToFetch(
    aggregationVariable: LogicAggregationVariable
  ): string[] {
    const fieldsToFetch: Set<string> = new Set()

    const addFieldToFetch = (variableKey: string) => {
      const entityVar = getLogicVariableByKey(variableKey)
      if (entityVar?.entity === 'USER') {
        fieldsToFetch.add((entityVar as UserLogicVariable).sourceField)
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

    return uniq([...Array.from(fieldsToFetch), 'createdTimestamp', 'userId'])
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
    let timestampForLookBack: number

    if (data.type === 'TRANSACTION') {
      const useEventTimestamp =
        aggregationVariable.useEventTimestamp &&
        data.transactionEvents.length > 0

      if (useEventTimestamp) {
        timestampForLookBack =
          last(data.transactionEvents)?.timestamp ?? data.transaction.timestamp
      } else {
        timestampForLookBack = data.transaction.timestamp
      }
    } else {
      timestampForLookBack = Date.now()
    }
    const { afterTimestamp, beforeTimestamp } = getTimeRangeByTimeWindows(
      timestampForLookBack,
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
            entityData: this.getEntityData(
              aggregationVariable,
              direction === 'origin'
                ? data.transaction.originPaymentDetails
                : data.transaction.destinationPaymentDetails
            ),
          }
        : { userId: data.user.userId }

    const aggregator = getLogicVariableAggregator(aggregationFunc)
    const entityVarDataloader = this.entityVarLoader(data, {
      baseCurrency: aggregationVariable.baseCurrency as
        | CurrencyCode
        | 'ORIGINAL_CURRENCY',
      tenantId: this.tenantId,
      dynamoDb: this.dynamoDb,
    })
    const newGroupValue = aggregationVariable.aggregationGroupByFieldKey
      ? ((await entityVarDataloader(
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
          ? getUserKeyId(data.transaction, direction, aggregationVariable.type)
          : data.user.userId
      if (!userKeyId) {
        return null
      }
      const userAggData =
        await this.aggregationRepository.getUserLogicTimeAggregations(
          userKeyId,
          aggregationVariable,
          afterTimestamp,
          beforeTimestamp,
          aggregationGranularity,
          newGroupValue
        )
      if (!userAggData) {
        if (
          ((hasFeature('RULES_ENGINE_V8_SYNC_REBUILD') ||
            this.backfillNamespace) &&
            data.type === 'TRANSACTION') ||
          data.type === 'USER'
        ) {
          const isRebuilt =
            data.type === 'TRANSACTION'
              ? await this.rebuildAggregationVariable(
                  aggregationVariable,
                  timestampForLookBack,
                  direction === 'origin'
                    ? data.transaction.originUserId
                    : data.transaction.destinationUserId,
                  direction === 'origin'
                    ? data.transaction.originPaymentDetails
                    : data.transaction.destinationPaymentDetails,
                  this.getEntityData(
                    aggregationVariable,
                    direction === 'origin'
                      ? data.transaction.originPaymentDetails
                      : data.transaction.destinationPaymentDetails
                  )
                )
              : await this.rebuildAggregationVariable(
                  aggregationVariable,
                  timestampForLookBack,
                  data.user.userId,
                  undefined,
                  undefined
                )
          if (isRebuilt) {
            throw new RebuildSyncRetryError()
          }
        }
      }

      aggData = userAggData ?? []
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
    const newTransactionIsTargetDirection =
      (direction === 'origin' &&
        aggregationVariable.transactionDirection !== 'RECEIVING') ||
      (direction === 'destination' &&
        aggregationVariable.transactionDirection !== 'SENDING')
    let result = aggregator.init()
    let shouldIncludeNewData = false
    let shouldSkipUpdateAggregation = false
    let newDataValue: any | undefined
    if (
      data.type === 'TRANSACTION' &&
      aggregationVariable.includeCurrentEntity &&
      newTransactionIsTargetDirection &&
      this.isNewDataWithinTimeWindow(
        timestampForLookBack,
        afterTimestamp,
        beforeTimestamp
      )
    ) {
      ;[shouldIncludeNewData, shouldSkipUpdateAggregation] = await Promise.all([
        this.isDataIncludedInAggregationVariable(aggregationVariable, data),
        this.isTransactionApplied(
          aggregationVariable,
          direction,
          data.transaction
        ),
      ])

      if (shouldIncludeNewData && !shouldSkipUpdateAggregation) {
        newDataValue = await this.getNewDataValueForAggregation(
          aggregationVariable,
          entityVarDataloader,
          direction
        )
      }
    }
    if (
      aggregationVariable.lastNEntities &&
      aggregationEntitiesCount === aggregationVariable.lastNEntities &&
      aggregationVariable.includeCurrentEntity &&
      !shouldSkipUpdateAggregation && // Skip removing the last entity in the N entity aggregation if we are not adding a new entity
      shouldIncludeNewData
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

    // NOTE: Merge the incoming transaction/user into the aggregation result
    if (newDataValue) {
      result = aggregator.reduce(result, newDataValue)
      aggregationEntitiesCount++
    }
    // To improve this as currently this returns null although the correct way should be to remove the last value from existing aggregation i.e pop value from last
    if (
      aggregationVariable.lastNEntities &&
      aggregationEntitiesCount < (aggregationVariable.lastNEntities ?? 0)
    ) {
      return null
    }

    return aggregator.compute(result)
  }

  private async loadAggregationDataUser(
    aggregationVariable: LogicAggregationVariable,
    data: UserLogicData
  ) {
    const { aggregationFunc } = aggregationVariable
    const { afterTimestamp, beforeTimestamp } = getTimeRangeByTimeWindows(
      data.userEvent?.timestamp ?? Date.now(),
      aggregationVariable.timeWindow.start as TimeWindow,
      aggregationVariable.timeWindow.end as TimeWindow
    )
    const isConsumer = isConsumerUser(data.user)
    const aggregationGranularity = getAggregationGranularity(
      aggregationVariable.timeWindow,
      this.tenantId
    )
    const userIdentifier: UserIdentifier = { userId: data.user.userId }

    const aggregator = getLogicVariableAggregator(aggregationFunc)
    const entityVarDataloader = this.entityVarLoader(data, {
      baseCurrency: aggregationVariable.baseCurrency as
        | CurrencyCode
        | 'ORIGINAL_CURRENCY',
      tenantId: this.tenantId,
      dynamoDb: this.dynamoDb,
    })
    const newGroupValue = aggregationVariable.aggregationGroupByFieldKey
      ? ((await entityVarDataloader(
          getEntityVariableLoaderKey({
            key: aggregationVariable.aggregationGroupByFieldKey,
            entityKey: aggregationVariable.aggregationGroupByFieldKey,
          })
        )) as string)
      : undefined
    let aggData: Array<{ time: string } & AggregationData> = []
    if (canAggregate(aggregationVariable.timeWindow)) {
      // If the mode is DYNAMODB, we fetch the pre-built aggregation data
      const userKeyId = data.user.userId
      if (!userKeyId) {
        return null
      }
      const userAggData =
        await this.aggregationRepository.getUserLogicTimeAggregations(
          userKeyId,
          aggregationVariable,
          afterTimestamp,
          beforeTimestamp,
          aggregationGranularity,
          newGroupValue
        )
      if (!userAggData) {
        if (
          (hasFeature('RULES_ENGINE_V8_SYNC_REBUILD') ||
            this.backfillNamespace) &&
          data.type === 'USER'
        ) {
          const isRebuilt =
            data.type === 'USER'
              ? await this.rebuildUserAggregationVariable(
                  aggregationVariable,
                  data.userEvent?.timestamp ?? Date.now(),
                  data.user.userId,
                  isConsumer
                )
              : null

          if (isRebuilt) {
            throw new RebuildSyncRetryError()
          }
        }
      }

      aggData = userAggData ?? []
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
    let shouldIncludeNewData = false
    let shouldSkipUpdateAggregation = false
    let newDataValue: any | undefined
    if (
      data.type === 'USER' &&
      aggregationVariable.includeCurrentEntity &&
      this.isNewDataWithinTimeWindowUser(data, afterTimestamp, beforeTimestamp)
    ) {
      ;[shouldIncludeNewData, shouldSkipUpdateAggregation] = await Promise.all([
        this.isDataIncludedInAggregationVariable(aggregationVariable, data),
        this.isUserEventApplied(
          aggregationVariable,
          data.userEvent?.eventId ?? ''
        ),
      ])
      if (shouldIncludeNewData && !shouldSkipUpdateAggregation) {
        newDataValue = await this.getNewDataValueForAggregation(
          aggregationVariable,
          entityVarDataloader
        )
      }
    }
    if (
      aggregationVariable.lastNEntities &&
      aggregationEntitiesCount === aggregationVariable.lastNEntities &&
      aggregationVariable.includeCurrentEntity &&
      !shouldSkipUpdateAggregation && // Skip removing the last entity in the N entity aggregation if we are not adding a new entity
      shouldIncludeNewData
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

    // NOTE: Merge the incoming transaction/user into the aggregation result
    if (newDataValue) {
      result = aggregator.reduce(result, newDataValue)
      aggregationEntitiesCount++
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
      entityData?: EntityData
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
          entityData: userIdentifier.entityData,
        },
        {
          afterTimestamp,
          beforeTimestamp,
        }
      )
    return Object.entries(rebuiltAggData).map(([time, value]) => ({
      time,
      ...(groupValue ? value.value?.[String(groupValue)] : value),
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
      (entityVariableKeys.find((v) =>
        v.startsWith(TRANSACTION_EVENT_ENTITY_VARIABLE_TYPE)
      ) ||
        aggregationVariable.useEventTimestamp)
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
        baseCurrency: aggregationVariable.baseCurrency as
          | CurrencyCode
          | 'ORIGINAL_CURRENCY',
        tenantId: this.tenantId,
      },
      data
    )

    return filterResult.hit
  }

  private isNewDataWithinTimeWindow(
    dataTimestampToCheck: number,
    afterTimestamp: number,
    beforeTimestamp: number
  ): boolean {
    return (
      dataTimestampToCheck !== undefined &&
      dataTimestampToCheck >= afterTimestamp &&
      dataTimestampToCheck <= beforeTimestamp
    )
  }
  private isNewDataWithinTimeWindowUser(
    data: UserLogicData,
    afterTimestamp: number,
    beforeTimestamp: number
  ): boolean {
    const inputTimestamp = data.userEvent?.timestamp ?? Date.now()
    return (
      inputTimestamp !== undefined &&
      inputTimestamp >= afterTimestamp &&
      inputTimestamp <= beforeTimestamp
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
    data:
      | {
          transaction: TransactionWithRiskDetails
          transactionEvents: TransactionEvent[]
        }
      | {
          user: User | Business
          userEvent?: UserEvent
        }
  ): Promise<void> {
    if (
      (!hasFeature('RULES_ENGINE_V8') && type === 'RULES') ||
      (!hasFeature('RISK_SCORING') && type === 'RISK') ||
      this.mode === 'MONGODB'
    ) {
      return
    }

    const promises: Promise<any>[] = []

    for (const aggVar of logicAggregationVariables ?? []) {
      const hash = getAggVarHash(aggVar)

      if (this.updatedAggregationVariables.has(hash)) {
        continue
      }

      if (aggVar.type === 'USER_DETAILS' && 'user' in data) {
        promises.push(
          this.updateUserAggregationVariable(aggVar, {
            type: 'USER',
            user: data.user,
            userEvent: data.userEvent,
          })
        )
        this.updatedAggregationVariables.add(hash)
      } else if (
        'transaction' in data &&
        'transactionEvents' in data &&
        aggVar.type !== 'USER_DETAILS'
      ) {
        promises.push(
          this.updateAggregationVariable(aggVar, {
            transaction: data.transaction,
            transactionEvents: data.transactionEvents,
            type: 'TRANSACTION',
          })
        )
        this.updatedAggregationVariables.add(hash)
      }
    }

    await Promise.all(promises)
    this.isTransactionApplied.cache.clear?.()
  }
}
