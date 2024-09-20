import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'

import { mapValues, pick } from 'lodash'
import { duration } from '@/utils/dayjs'
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

export type AggregationData<T = unknown> = {
  value: T | { [group: string]: T }
  entities?: {
    value: T
    timestamp?: number
  }[]
}

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

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
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
      return {
        ...data,
        ttl: this.getUpdatedTtlAttribute(aggregationVariable),
      }
    })
    const putRequests = Object.entries(aggregationDataWithTtl)
      .map((entry) => {
        const keys = DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION(
          this.tenantId,
          userKeyId,
          getAggVarHash(aggregationVariable),
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
          getAggVarHash(aggregationVariable),
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
    await batchWrite(
      this.dynamoDb,
      writeRequests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
  }

  public async getUserLogicTimeAggregations<T>(
    userKeyId: string,
    aggregationVariable: LogicAggregationVariable,
    afterTimestamp: number,
    beforeTimestamp: number,
    granularity: LogicAggregationTimeWindowGranularity,
    groupValue?: string
  ): Promise<Array<{ time: string } & AggregationData<T>> | undefined> {
    const queryInput: QueryCommandInput = dynamoDbQueryHelper({
      tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      sortKey: {
        from: getTransactionStatsTimeGroupLabel(afterTimestamp, granularity),
        to: getTransactionStatsTimeGroupLabel(beforeTimestamp - 1, granularity),
      },
      partitionKey: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION(
        this.tenantId,
        userKeyId,
        getAggVarHash(aggregationVariable),
        groupValue
      ).PartitionKeyID,
    })

    const result = await paginateQuery(this.dynamoDb, queryInput)
    const hasData = (result?.Items?.length || 0) > 0
    if (!hasData) {
      const result = await paginateQuery(this.dynamoDb, {
        ...queryInput,
        Limit: 1,
      })
      const isRebuilt = Boolean(result.Count)
      if (isRebuilt) {
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

  public async setTransactionApplied(
    aggregationVariable: LogicAggregationVariable,
    direction: 'origin' | 'destination',
    transactionId: string
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER(
          this.tenantId,
          direction,
          getAggVarHash(aggregationVariable),
          transactionId
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER(
        this.tenantId,
        direction,
        getAggVarHash(aggregationVariable),
        transactionId
      ),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return Boolean(result.Item)
  }

  public async setAggregationVariableReady(
    aggregationVariable: LogicAggregationVariable,
    userKeyId: string,
    lastTransactionTimestamp: number
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER(
          this.tenantId,
          userKeyId,
          getAggVarHash(aggregationVariable)
        ),
        lastTransactionTimestamp,
        ttl: duration(1, 'year').asSeconds(),
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  public async isAggregationVariableReady(
    aggregationVariable: LogicAggregationVariable,
    userKeyId: string
  ): Promise<{ ready: boolean; lastTransactionTimestamp: number }> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER(
        this.tenantId,
        userKeyId,
        getAggVarHash(aggregationVariable)
      ),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    const lastTransactionTimestamp = result.Item?.lastTransactionTimestamp ?? 0
    return { ready: Boolean(result.Item), lastTransactionTimestamp }
  }

  private getUpdatedTtlAttribute(
    aggregationVariable: LogicAggregationVariable
  ): number {
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
}
