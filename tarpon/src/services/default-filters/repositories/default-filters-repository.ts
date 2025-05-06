import {
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DefaultManualScreeningFiltersRequest } from '@/@types/openapi-internal/DefaultManualScreeningFiltersRequest'
import { DefaultManualScreeningFiltersResponse } from '@/@types/openapi-internal/DefaultManualScreeningFiltersResponse'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getContext } from '@/core/utils/context-storage'
@traceable
export class DefaultFiltersRepository {
  private tenantId: string
  private tableName: string
  constructor(tenantId: string) {
    this.tenantId = tenantId
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async createDefaultFilters(
    filters: DefaultManualScreeningFiltersRequest,
    dynamoDb: DynamoDBClient
  ): Promise<DefaultManualScreeningFiltersResponse> {
    // First delete any existing entry
    const key = DynamoDbKeys.DEFAULT_FILTERS(this.tenantId)
    await dynamoDb.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PartitionKeyID: key.PartitionKeyID,
          SortKeyID: key.SortKeyID,
        },
      })
    )

    // Then create the new entry
    const timestamp = Date.now()
    const createdBy = getContext()?.user?.id
    const updatedBy = createdBy
    const item = {
      ...key,
      ...filters,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy,
      updatedBy,
    }

    await dynamoDb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    )

    return this.mapDynamoItemToDefaultFilters(item)
  }

  private mapDynamoItemToDefaultFilters(
    item: any
  ): DefaultManualScreeningFiltersResponse {
    // remove the PartitionKeyID and SortKeyID from the item
    delete item.PartitionKeyID
    delete item.SortKeyID

    return item as DefaultManualScreeningFiltersResponse
  }

  public async getDefaultFilters(
    dynamoDb: DynamoDBClient
  ): Promise<DefaultManualScreeningFiltersResponse | null> {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :partitionKey',
      ExpressionAttributeValues: {
        ':partitionKey': DynamoDbKeys.DEFAULT_FILTERS(this.tenantId)
          .PartitionKeyID,
      },
    }

    const { Items } = await dynamoDb.send(new QueryCommand(queryInput))

    if (!Items || Items.length === 0) {
      return null
    }

    return this.mapDynamoItemToDefaultFilters(Items[0])
  }
}
