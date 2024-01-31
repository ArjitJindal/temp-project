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
import { getTransactionStatsTimeGroupLabel } from '../utils/transaction-rule-utils'
import { duration } from '@/utils/dayjs'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  batchWrite,
  dynamoDbQueryHelper,
  paginateQuery,
} from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { generateChecksum } from '@/utils/object'
import { RuleAggregationTimeWindowGranularity } from '@/@types/openapi-internal/RuleAggregationTimeWindowGranularity'

export type AggregationData<T = unknown> = { value: T }

// Increment this version when we need to invalidate all existing aggregations.
const GLOBAL_AGG_VERSION = 'v1'
const RULE_AGG_VAR_CHECKSUM_FIELDS: Array<keyof RuleAggregationVariable> = [
  'type',
  'direction',
  'aggregationFieldKey',
  'aggregationFunc',
  'timeWindow',
  'filtersLogic',
  'baseCurrency',
]

export function getAggVarHash(
  aggregationVariable: RuleAggregationVariable,
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

  public async rebuildUserTimeAggregations(
    userKeyId: string,
    aggregationVariable: RuleAggregationVariable,
    aggregationData: {
      [time: string]: AggregationData
    }
  ) {
    const aggregationDataWithTtl = mapValues(aggregationData, (data) => {
      return {
        ...data,
        ttl: this.getUpdatedTtlAttribute(aggregationVariable),
      }
    })
    const writeRequests = Object.entries(aggregationDataWithTtl).map(
      (entry) => {
        const keys = DynamoDbKeys.V8_RULE_USER_TIME_AGGREGATION(
          this.tenantId,
          userKeyId,
          getAggVarHash(aggregationVariable),
          entry[0]
        )
        return {
          PutRequest: {
            Item: {
              ...keys,
              ...entry[1],
            },
          },
        }
      }
    )
    await batchWrite(
      this.dynamoDb,
      writeRequests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
  }

  public async getUserRuleTimeAggregations<T>(
    userKeyId: string,
    aggregationVariable: RuleAggregationVariable,
    afterTimestamp: number,
    beforeTimestamp: number,
    granularity: RuleAggregationTimeWindowGranularity
  ): Promise<Array<{ time: string } & AggregationData<T>> | undefined> {
    const queryInput: QueryCommandInput = dynamoDbQueryHelper({
      tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      sortKey: {
        from: getTransactionStatsTimeGroupLabel(afterTimestamp, granularity),
        to: getTransactionStatsTimeGroupLabel(beforeTimestamp - 1, granularity),
      },
      partitionKey: DynamoDbKeys.V8_RULE_USER_TIME_AGGREGATION(
        this.tenantId,
        userKeyId,
        getAggVarHash(aggregationVariable)
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
        }))
      : undefined
  }

  public async setTransactionApplied(
    aggregationVariable: RuleAggregationVariable,
    direction: 'origin' | 'destination',
    transactionId: string
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.V8_RULE_USER_TIME_AGGREGATION_TX_MARKER(
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
    aggregationVariable: RuleAggregationVariable,
    direction: 'origin' | 'destination',
    transactionId: string
  ): Promise<boolean> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.V8_RULE_USER_TIME_AGGREGATION_TX_MARKER(
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
    aggregationVariable: RuleAggregationVariable,
    userKeyId: string
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.V8_RULE_USER_TIME_AGGREGATION_READY_MARKER(
          this.tenantId,
          userKeyId,
          getAggVarHash(aggregationVariable)
        ),
        ttl: this.getUpdatedTtlAttribute(aggregationVariable),
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  public async isAggregationVariableReady(
    aggregationVariable: RuleAggregationVariable,
    userKeyId: string
  ): Promise<boolean> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.V8_RULE_USER_TIME_AGGREGATION_READY_MARKER(
        this.tenantId,
        userKeyId,
        getAggVarHash(aggregationVariable)
      ),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return Boolean(result.Item)
  }

  private getUpdatedTtlAttribute(
    aggregationVariable: RuleAggregationVariable
  ): number {
    const units = aggregationVariable.timeWindow.start.units
    let granularity = aggregationVariable.timeWindow.start.granularity

    if (granularity === 'fiscal_year') {
      granularity = 'year'
    }
    return (
      Math.floor(Date.now() / 1000) +
      duration(units, granularity).asSeconds() +
      86400 // add 1 day buffer
    )
  }
}
