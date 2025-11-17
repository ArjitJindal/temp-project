import { StackConstants } from '@lib/constants'
import {
  DeleteCommand,
  DeleteCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import keyBy from 'lodash/keyBy'
import mapValues from 'lodash/mapValues'
import pick from 'lodash/pick'
import uniq from 'lodash/uniq'
import dayjs, { duration } from '@/utils/dayjs'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  BatchWriteRequestInternal,
  batchWrite,
  dynamoDbQueryHelper,
  paginateQuery,
} from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { generateChecksum } from '@/utils/object'
import { getTransactionStatsTimeGroupLabel } from '@/services/rules-engine/utils/transaction-rule-utils'
import { LogicAggregationVariable } from '@/@types/openapi-internal/LogicAggregationVariable'
import { LogicAggregationTimeWindowGranularity } from '@/@types/openapi-internal/LogicAggregationTimeWindowGranularity'
import { UsedAggregationVariable } from '@/@types/openapi-internal/UsedAggregationVariable'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export type AggregationData<T = unknown> = {
  value: T | { [group: string]: T }
  entities?: {
    value: T
    timestamp?: number
  }[]
}

export type BulkApplyMarkerTransactionData = {
  transactionId: string
  direction: 'origin' | 'destination'
}[]

export type BulkApplyMarkerUserData = {
  userId: string
}[]

export const TIME_SLICE_COUNT = 5
// Increment this version when we need to invalidate all existing aggregations.
const GLOBAL_AGG_VERSION = 'v1'
const RULE_AGG_VAR_CHECKSUM_FIELDS: Array<keyof LogicAggregationVariable> = [
  'type',
  'transactionDirection',
  'aggregationFieldKey',
  'aggregationGroupByFieldKey',
  'aggregationFunc',
  'timeWindow',
  'filtersLogic',
  'baseCurrency',
  'aggregationFilterFieldKey',
  'aggregationFilterFieldValue',
  'useEventTimestamp',
]

export function getAggVarHash(
  aggregationVariable: LogicAggregationVariable,
  versioned = true
): string {
  let checksumFields = RULE_AGG_VAR_CHECKSUM_FIELDS
  if (versioned) {
    checksumFields = checksumFields.concat(['version'])
  }
  return `${GLOBAL_AGG_VERSION}-${generateChecksum(
    pick(aggregationVariable, checksumFields),
    10
  )}`
}

@traceable
export class AggregationRepository {
  dynamoDb: DynamoDBDocumentClient
  tenantId: string
  backfillNamespace: string | undefined
  aggregationDynamoTable: string
  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
    this.aggregationDynamoTable =
      tenantId === '4c9cdf0251'
        ? StackConstants.AGGREGATION_DYNAMODB_TABLE_NAME
        : StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
  }

  public setBackfillNamespace(backfillNamespace: string | undefined) {
    this.backfillNamespace = backfillNamespace
  }

  public getUserTimeAggregationsRebuildWriteRequests(
    userKeyId: string,
    aggregationVariable: LogicAggregationVariable,
    aggregationData: {
      [time: string]: AggregationData
    },
    groupValue: string | undefined
  ): BatchWriteRequestInternal[] {
    const aggregationDataWithTtl = mapValues(aggregationData, (data) => {
      const truncatedValue = Array.isArray(data.value)
        ? this.truncateArray(data.value)
        : data.value

      return {
        ...data,
        value: truncatedValue,
        ttl: this.getUpdatedTtlAttribute(aggregationVariable),
      }
    })
    const putRequests = Object.entries(aggregationDataWithTtl)
      .map((entry) => {
        const keys = DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION(
          this.tenantId,
          userKeyId,
          getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
          groupValue,
          entry[0]
        )
        if (entry[1].entities == null || entry[1].entities.length > 0) {
          return {
            PutRequest: {
              Item: {
                ...keys,
                ...entry[1],
              },
            },
          }
        }
      })
      .filter(Boolean) as BatchWriteRequestInternal[]
    const deleteReqests = Object.entries(aggregationDataWithTtl)
      .map((entry) => {
        const keys = DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION(
          this.tenantId,
          userKeyId,
          getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
          groupValue,
          entry[0]
        )
        if (entry[1].entities != null && entry[1].entities.length === 0) {
          return {
            DeleteRequest: {
              Key: keys,
            },
          }
        }
      })
      .filter(Boolean) as BatchWriteRequestInternal[]

    return putRequests.concat(deleteReqests)
  }

  public async rebuildUserTimeAggregations(
    userKeyId: string,
    aggregationVariable: LogicAggregationVariable,
    aggregationData: {
      [time: string]: AggregationData
    },
    groupValue: string | undefined
  ) {
    const writeRequests = this.getUserTimeAggregationsRebuildWriteRequests(
      userKeyId,
      aggregationVariable,
      aggregationData,
      groupValue
    )
    await batchWrite(this.dynamoDb, writeRequests, this.aggregationDynamoTable)
  }

  public async getUserLogicTimeAggregations<T>(
    userKeyId: string,
    aggregationVariable: LogicAggregationVariable,
    afterTimestamp: number,
    beforeTimestamp: number,
    granularity: LogicAggregationTimeWindowGranularity,
    groupValue?: string
  ): Promise<Array<{ time: string } & AggregationData<T>> | undefined> {
    if (afterTimestamp === beforeTimestamp) {
      /*  We early return empty as the timewindow is empty in this case and we will get an error 
      while trying to fetch from dynamo */
      return []
    }
    const queryInput: QueryCommandInput = dynamoDbQueryHelper({
      tableName: this.aggregationDynamoTable,
      sortKey: {
        from: getTransactionStatsTimeGroupLabel(afterTimestamp, granularity),
        to: getTransactionStatsTimeGroupLabel(beforeTimestamp - 1, granularity),
      },
      partitionKey: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION(
        this.tenantId,
        userKeyId,
        getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
        groupValue
      ).PartitionKeyID,
      consistentRead: true,
    })

    if (this.backfillNamespace) {
      // In the backfill mode (for rerunning rules for past transactions), we always rebuild once
      // when we encounter the first transaction of a user. We return undefined here if the aggregation
      // variable is not ready to trigger the rebuild.
      const { ready } = await this.isAggregationVariableReady(
        aggregationVariable,
        userKeyId
      )
      if (!ready) {
        return
      }
    }

    const result = await paginateQuery(this.dynamoDb, queryInput)
    const hasData = (result?.Items?.length || 0) > 0
    if (!hasData) {
      const { ready } = await this.isAggregationVariableReady(
        aggregationVariable,
        userKeyId
      )

      if (ready) {
        // We return an empty array instead of undefined as it's not a cache miss.
        return []
      }
    }
    return hasData
      ? result?.Items?.map((item) => ({
          time: item.SortKeyID,
          value: item.value as T,
          entities: item.entities,
        }))
      : undefined
  }

  public async bulkMarkTransactionApplied(
    aggregationVariable: LogicAggregationVariable,
    applyMarkerTransactionData: BulkApplyMarkerTransactionData
  ) {
    const writeRequests: BatchWriteRequestInternal[] =
      applyMarkerTransactionData.map((data) => {
        const keys = DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER(
          this.tenantId,
          data.direction,
          getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
          data.transactionId
        )
        const request = {
          PutRequest: {
            Item: {
              ...keys,
              ttl: this.getUpdatedTtlAttribute(aggregationVariable),
            },
          },
        }
        return request
      })
    await batchWrite(this.dynamoDb, writeRequests, this.aggregationDynamoTable)
  }
  public async bulkMarkUserEventApplied(
    aggregationVariable: LogicAggregationVariable,
    applyMarkerUserData: BulkApplyMarkerUserData
  ) {
    const writeRequests: BatchWriteRequestInternal[] = applyMarkerUserData.map(
      (data) => {
        const keys =
          DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_USER_EVENT_MARKER(
            this.tenantId,
            getAggVarHash(aggregationVariable) +
              this.getBackfillVersionSuffix(),
            data.userId
          )
        const request = {
          PutRequest: {
            Item: {
              ...keys,
              ttl: this.getUpdatedTtlAttribute(aggregationVariable),
            },
          },
        }
        return request
      }
    )
    await batchWrite(
      this.dynamoDb,
      writeRequests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )
  }

  public async setTransactionApplied(
    aggregationVariable: LogicAggregationVariable,
    direction: 'origin' | 'destination',
    transactionId: string
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: this.aggregationDynamoTable,
      Item: {
        ...DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER(
          this.tenantId,
          direction,
          getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
          transactionId
        ),
        ttl: this.getUpdatedTtlAttribute(aggregationVariable),
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  public async setUserEventApplied(
    aggregationVariable: LogicAggregationVariable,
    eventId: string
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_USER_EVENT_MARKER(
          this.tenantId,
          getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
          eventId
        ),
        ttl: this.getUpdatedTtlAttribute(aggregationVariable),
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  public async isTransactionApplied(
    aggregationVariable: LogicAggregationVariable,
    direction: 'origin' | 'destination',
    transactionId: string
  ): Promise<boolean> {
    const getItemInput: GetCommandInput = {
      TableName: this.aggregationDynamoTable,
      Key: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER(
        this.tenantId,
        direction,
        getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
        transactionId
      ),
      ConsistentRead: true,
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return Boolean(result.Item)
  }

  public async isUserEventApplied(
    aggregationVariable: LogicAggregationVariable,
    eventId: string
  ): Promise<boolean> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_USER_EVENT_MARKER(
        this.tenantId,
        getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix(),
        eventId
      ),
      ConsistentRead: true,
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return Boolean(result.Item)
  }

  private getBackfillVersionSuffix(): string {
    return this.backfillNamespace
      ? generateChecksum(this.backfillNamespace, 5)
      : ''
  }
  private getBackfillTTL(): number {
    return Math.floor(dayjs().add(1, 'week').valueOf() / 1000)
  }

  public async setAggregationVariableReady(
    aggregationVariable: LogicAggregationVariable,
    userKeyId: string,
    lastTransactionTimestamp: number,
    totalTimeSlices?: number,
    isSyncRebuild?: boolean,
    sliceNumber?: number
  ): Promise<void> {
    const ttl = this.backfillNamespace
      ? this.getBackfillTTL()
      : Math.floor(Date.now() / 1000) + duration(1, 'year').asSeconds()
    const updateItemInput: UpdateCommandInput = {
      TableName: this.aggregationDynamoTable,
      UpdateExpression:
        'SET lastTransactionTimestamp = :lastTransactionTimestamp, totalTimeSlices = :totalTimeSlices, #ttl = :ttl, isSyncRebuild=:isSyncRebuild ADD timeSlices :sliceNumber ',
      ExpressionAttributeNames: {
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':lastTransactionTimestamp': lastTransactionTimestamp,
        ':totalTimeSlices': totalTimeSlices ?? 1,
        ':ttl': ttl,
        ':isSyncRebuild': isSyncRebuild ?? false,
        ':sliceNumber': new Set<number>([sliceNumber ?? 1]),
      },
      Key: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER(
        this.tenantId,
        userKeyId,
        getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix()
      ),
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
  }
  public async setUserAggregationVariableReady(
    aggregationVariable: LogicAggregationVariable,
    userKeyId: string,
    lastTransactionTimestamp: number
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Item: {
        ...DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER(
          this.tenantId,
          userKeyId,
          getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix()
        ),
        lastTransactionTimestamp,
        ttl: this.backfillNamespace
          ? this.getBackfillTTL()
          : Math.floor(Date.now() / 1000) + duration(1, 'year').asSeconds(),
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  public async isAggregationVariableReady(
    aggregationVariable: LogicAggregationVariable,
    userKeyId: string
  ): Promise<{ ready: boolean; lastTransactionTimestamp: number }> {
    const getItemInput: GetCommandInput = {
      TableName: this.aggregationDynamoTable,
      Key: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER(
        this.tenantId,
        userKeyId,
        getAggVarHash(aggregationVariable) + this.getBackfillVersionSuffix()
      ),
      ConsistentRead: true,
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    const noOfReadySlices = result.Item?.sliceCount ?? 1 // Keeping to avoid breaking existing rebuilds
    const totalTimeSlices = result.Item?.totalTimeSlices ?? 1
    const lastTransactionTimestamp = result.Item?.lastTransactionTimestamp ?? 0
    const isSyncRebuild = result.Item?.isSyncRebuild ?? false
    const timeSlices = (result.Item?.timeSlices ??
      new Set<number>([1])) as Set<number>
    return {
      ready:
        Boolean(result.Item) &&
        (noOfReadySlices == totalTimeSlices ||
          isSyncRebuild ||
          Array.from(timeSlices).length === totalTimeSlices),
      lastTransactionTimestamp,
    }
  }

  private getUpdatedTtlAttribute(
    aggregationVariable: LogicAggregationVariable
  ): number {
    if (this.backfillNamespace) {
      return this.getBackfillTTL()
    }

    let { units, granularity } = aggregationVariable.timeWindow.start

    if (granularity === 'now') {
      throw new Error('Start time window cannot be "now".')
    }

    if (granularity === 'fiscal_year') {
      granularity = 'year'
    } else if (granularity === 'all_time') {
      granularity = 'year'
      units = 5
    }
    return (
      Math.floor(Date.now() / 1000) +
      duration(units, granularity).asSeconds() +
      // Add 2 months to the TTL to make sure the data is still available when
      // the transaction events of a transaction are processed (assuming that the life
      // cycle of a single transaction shouldn't span across 2 months).
      duration(2, 'month').asSeconds()
    )
  }

  public async updateLogicAggVars(
    newEntity: RuleInstance | RiskFactor | undefined,
    entityId: string,
    oldEntity?: RuleInstance | RiskFactor
  ): Promise<LogicAggregationVariable[]> {
    if (!newEntity && oldEntity !== undefined) {
      await Promise.all(
        oldEntity.logicAggregationVariables?.map(async (aggVar) => {
          await this.removeEntityFromOldAggVar(aggVar, entityId)
        }) ?? []
      )
      return []
    }
    const newAggVars = newEntity?.logicAggregationVariables ?? []
    const oldAggVarMap = keyBy(
      oldEntity?.logicAggregationVariables ?? [],
      'key'
    )
    return Promise.all(
      newAggVars.map(async (newAggVar) => {
        const oldAggVar = oldAggVarMap[newAggVar.key]
        const updatedVersion = await this.getNewLogicAggVarVersion(
          newAggVar,
          entityId,
          oldAggVar
        )
        return { ...newAggVar, version: updatedVersion }
      })
    )
  }

  private async getNewLogicAggVarVersion(
    aggregationVariable: LogicAggregationVariable,
    entityId: string,
    oldAggregationVariable?: LogicAggregationVariable
  ): Promise<number> {
    const newVersion = Date.now()

    if (oldAggregationVariable) {
      if (this.isAggVarUnchanged(oldAggregationVariable, aggregationVariable)) {
        return oldAggregationVariable.version ?? newVersion
      }
      await this.removeEntityFromOldAggVar(oldAggregationVariable, entityId)
    }

    const usedAggVar = await this.getUsedAggVar(aggregationVariable, newVersion)
    await this.updateOrCreateUsedAggVar(usedAggVar, [
      ...(usedAggVar.usedEntityIds || []),
      entityId,
    ])
    return usedAggVar.version
  }

  private isAggVarUnchanged(
    oldAggVar: LogicAggregationVariable,
    newAggVar: LogicAggregationVariable
  ): boolean {
    return getAggVarHash(oldAggVar, false) === getAggVarHash(newAggVar, false)
  }

  private async removeEntityFromOldAggVar(
    oldAggVar: LogicAggregationVariable,
    entityId: string
  ): Promise<void> {
    const oldAggVarHash = getAggVarHash(oldAggVar, false)
    const getItemInput: GetCommandInput = {
      TableName: this.aggregationDynamoTable,
      Key: DynamoDbKeys.AGGREGATION_VARIABLE(this.tenantId, oldAggVarHash),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    if (result.Item) {
      const usedAggVar = result.Item as UsedAggregationVariable
      const updatedIds =
        usedAggVar.usedEntityIds?.filter((id) => id !== entityId) ?? []
      if (updatedIds.length === 0) {
        await this.deleteUsedAggVar(usedAggVar)
      } else {
        await this.updateOrCreateUsedAggVar(usedAggVar, updatedIds)
      }
    }
  }

  private async deleteUsedAggVar(
    usedAggVar: UsedAggregationVariable
  ): Promise<void> {
    const deleteItemInput: DeleteCommandInput = {
      TableName: this.aggregationDynamoTable,
      Key: DynamoDbKeys.AGGREGATION_VARIABLE(
        this.tenantId,
        usedAggVar.aggVarHash
      ),
    }
    await this.dynamoDb.send(new DeleteCommand(deleteItemInput))
  }

  public async getUsedAggVar(
    aggregationVariable: LogicAggregationVariable,
    newVersion: number
  ): Promise<UsedAggregationVariable> {
    const aggVarHash = getAggVarHash(aggregationVariable, false)
    const getItemInput: GetCommandInput = {
      TableName: this.aggregationDynamoTable,
      Key: DynamoDbKeys.AGGREGATION_VARIABLE(this.tenantId, aggVarHash),
      ConsistentRead: true,
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return (
      (result.Item as UsedAggregationVariable) ?? {
        aggVarHash,
        version: newVersion,
        usedEntityIds: [],
      }
    )
  }

  public async updateOrCreateUsedAggVar(
    usedAggVar: UsedAggregationVariable,
    updatedIds: string[]
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: this.aggregationDynamoTable,
      Item: {
        ...DynamoDbKeys.AGGREGATION_VARIABLE(
          this.tenantId,
          usedAggVar.aggVarHash
        ),
        ...usedAggVar,
        usedEntityIds: uniq(updatedIds),
      } as UsedAggregationVariable,
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  private truncateArray<T>(arr: T[]): T[] {
    const MAX_SIZE = 380 * 1024 // 380KB
    const totalSize = new TextEncoder().encode(JSON.stringify(arr)).length
    const ratio = totalSize / MAX_SIZE

    if (ratio <= 1) {
      return arr
    }

    let truncatedLength = Math.floor(arr.length / ratio)
    let truncatedArray = arr.slice(0, truncatedLength)

    while (
      new TextEncoder().encode(JSON.stringify(truncatedArray)).length > MAX_SIZE
    ) {
      truncatedLength--
      truncatedArray = arr.slice(0, truncatedLength)
    }

    return truncatedArray
  }
}
