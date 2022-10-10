import { StackConstants } from '@cdk/constants'
import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client'
import { v4 as uuidv4 } from 'uuid'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ListExisted } from '@/@types/openapi-public/ListExisted'
import { ListHeader } from '@/@types/openapi-public/ListHeader'
import { ListData } from '@/@types/openapi-public/ListData'
import {
  batchWrite,
  CursorPaginatedResponse,
  paginateQuery,
} from '@/utils/dynamodb'
import { ListItem } from '@/@types/openapi-public/ListItem'
import { neverReturn } from '@/utils/lang'
import { ListType } from '@/@types/openapi-public/ListType'

export class ListRepository {
  dynamoDb: DynamoDBDocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  async createList(
    listType: ListType,
    newList: ListData = {}
  ): Promise<ListExisted> {
    const listId = uuidv4()
    const { items = [], metadata } = newList
    const header = {
      metadata,
      listId,
      listType,
      createdTimestamp: Date.now(),
      size: items.length,
    }
    await this.updateListHeader(header)
    await this.updateListItems(listType, listId, items)
    return {
      listId,
      header,
      items,
    }
  }

  async deleteList(listType: ListType, listId: string) {
    const header = await this.getListHeader(listType, listId)
    if (header == null) {
      throw new Error(`List not find by id "${listId}"`)
    }
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Item: {
          ...DynamoDbKeys.LIST_DELETED(this.tenantId, header.listType, listId),
          header,
        },
      })
    )
    await this.dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.LIST_HEADER(this.tenantId, listType, listId),
      })
    )
  }

  async getListHeaders(
    listType: ListType | null = null
  ): Promise<ListHeader[]> {
    const primaryKey = DynamoDbKeys.LIST_HEADER(
      this.tenantId,
      listType ?? '',
      ''
    )
    const { Items = [] } = await paginateQuery(this.dynamoDb, {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression:
        listType == null
          ? 'PartitionKeyID = :pk'
          : 'PartitionKeyID = :pk AND begins_with(SortKeyID, :sk)',
      ExpressionAttributeValues:
        listType == null
          ? {
              ':pk': primaryKey.PartitionKeyID,
            }
          : {
              ':pk': primaryKey.PartitionKeyID,
              ':sk': primaryKey.SortKeyID,
            },
    })
    return Items.map(({ header }) => header)
  }

  async getListHeader(
    listType: ListType,
    listId: string
  ): Promise<ListHeader | null> {
    const { Item } = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.LIST_HEADER(this.tenantId, listType, listId),
      })
    )
    if (Item == null) {
      return null
    }
    const { header } = Item
    return header
  }

  async updateListHeader(listHeader: ListHeader): Promise<void> {
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Item: {
          ...DynamoDbKeys.LIST_HEADER(
            this.tenantId,
            listHeader.listType,
            listHeader.listId
          ),
          header: listHeader,
        },
      })
    )
  }

  async refreshListHeader(listHeader: ListHeader): Promise<void> {
    await this.updateListHeader({
      ...listHeader,
      size: await this.countListValues(listHeader.listType, listHeader.listId),
    })
  }

  async getListItem(
    listType: ListType,
    listId: string,
    key: string
  ): Promise<ListItem | null> {
    const header = await this.getListHeader(listType, listId)
    if (header == null) {
      throw new Error(`List doesn't exist`)
    }
    const { Item } = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.LIST_ITEM(this.tenantId, listId, key),
      })
    )
    if (Item == null) {
      return null
    }
    return { key: Item.key, metadata: Item.metadata }
  }

  async setListItem(listType: ListType, listId: string, listItem: ListItem) {
    const header = await this.getListHeader(listType, listId)
    if (header == null) {
      throw new Error(`List doesn't exist`)
    }
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Item: {
          ...DynamoDbKeys.LIST_ITEM(this.tenantId, listId, listItem.key),
          ...listItem,
        },
      })
    )
    await this.refreshListHeader(header)
  }

  async deleteListItem(listType: ListType, listId: string, key: string) {
    const header = await this.getListHeader(listType, listId)
    if (header == null) {
      throw new Error(`List doesn't exist`)
    }
    await this.dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.LIST_ITEM(this.tenantId, listId, key),
      })
    )
    await this.refreshListHeader(header)
  }

  async updateListItems(
    listType: ListType,
    listId: string,
    listItems: ListItem[]
  ) {
    const header = await this.getListHeader(listType, listId)
    if (header == null) {
      throw new Error(`List doesn't exist`)
    }
    const map: { [key: string]: DocumentClient.WriteRequest } = {}
    for (const item of listItems) {
      map[item.key] = {
        PutRequest: {
          Item: {
            ...DynamoDbKeys.LIST_ITEM(this.tenantId, listId, item.key),
            ...item,
          },
        },
      }
    }

    await batchWrite(
      this.dynamoDb,
      Object.values(map),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.refreshListHeader(header)
  }

  async getListItems(
    listType: ListType,
    listId: string,
    params?: {
      cursor?: string
    }
  ): Promise<CursorPaginatedResponse<ListItem>> {
    const { Items = [], LastEvaluatedKey } = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.LIST_ITEM(this.tenantId, listId, '')
            .PartitionKeyID,
        },
        ExclusiveStartKey: params?.cursor
          ? DynamoDbKeys.LIST_ITEM(this.tenantId, listId, params?.cursor)
          : undefined,
        Limit: 20,
      })
    )
    const items: ListItem[] = Items.map(({ key, metadata }) => ({
      key,
      metadata,
    }))
    return {
      items,
      cursor:
        LastEvaluatedKey != null && items.length > 0
          ? items[items.length - 1].key
          : undefined,
    }
  }

  async countListValues(listType: ListType, listId: string): Promise<number> {
    const { Count } = await paginateQuery(this.dynamoDb, {
      Select: 'COUNT',
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.LIST_ITEM(this.tenantId, listId, '').PartitionKeyID,
      },
    })
    return Count ?? 0
  }

  async match(
    listId: string,
    value: string,
    method: 'EXACT' | 'PREFIX'
  ): Promise<boolean> {
    const key = DynamoDbKeys.LIST_ITEM(this.tenantId, listId, value)

    let KeyConditionExpression: string
    if (method === 'EXACT') {
      KeyConditionExpression = 'PartitionKeyID = :pk AND SortKeyID = :sk'
    } else if (method === 'PREFIX') {
      KeyConditionExpression =
        'PartitionKeyID = :pk AND begins_with ( SortKeyID, :sk )'
    } else {
      KeyConditionExpression = neverReturn(method, 'PartitionKeyID = :pk')
    }

    const { Items = [] } = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        KeyConditionExpression,
        ExpressionAttributeValues: {
          ':pk': key.PartitionKeyID,
          ':sk': key.SortKeyID,
        },
        Limit: 1,
      })
    )
    return Items.length > 0
  }

  async importList(
    listType: ListType,
    listId: string,
    indexName: string,
    rows: Array<{ [key: string]: string }>
  ): Promise<void> {
    await this.updateListItems(
      listType,
      listId,
      rows.map((row) => {
        const key = row[indexName]
        if (!key) {
          throw new Error(`row: ${row} has missing '${indexName}' field!`)
        }
        return {
          key,
          metadata: row,
        }
      })
    )
  }
}
