import { StackConstants } from '@lib/constants'
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
  BatchWriteRequestInternal,
  paginateQuery,
  PutRequestInternal,
} from '@/utils/dynamodb'
import { ListItem } from '@/@types/openapi-public/ListItem'
import { neverReturn } from '@/utils/lang'
import { ListType } from '@/@types/openapi-public/ListType'
import { ListSubtype } from '@/@types/openapi-public/ListSubtype'
import { traceable } from '@/core/xray'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
  DEFAULT_PAGE_SIZE,
} from '@/utils/pagination'

@traceable
export class ListRepository {
  dynamoDb: DynamoDBDocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  public async createList(
    listType: ListType,
    subtype: ListSubtype,
    newList: ListData = {},
    mannualListId?: string
  ): Promise<ListExisted> {
    const listId = mannualListId ?? uuidv4()
    const { items = [], metadata } = newList
    const header = {
      metadata,
      listId,
      listType,
      subtype,
      createdTimestamp: Date.now(),
      size: items.length,
    }
    await this.updateListHeader(header)
    await this.updateListItems(listId, items)
    return {
      listId,
      header,
      items,
    }
  }

  public async deleteList(listId: string) {
    const header = await this.getListHeader(listId)
    if (header == null) {
      throw new Error(`List not find by id "${listId}"`)
    }
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Item: {
          ...DynamoDbKeys.LIST_DELETED(this.tenantId, listId),
          header,
        },
      })
    )
    await this.dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.LIST_HEADER(this.tenantId, listId),
      })
    )
  }

  public async getListHeaders(
    listType: ListType | null = null
  ): Promise<ListHeader[]> {
    const primaryKey = DynamoDbKeys.LIST_HEADER(this.tenantId, '')
    const query = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression:
        listType != null ? 'header.listType = :listType' : undefined,
      ExpressionAttributeValues:
        listType == null
          ? {
              ':pk': primaryKey.PartitionKeyID,
            }
          : {
              ':pk': primaryKey.PartitionKeyID,
              ':listType': listType,
            },
    }
    const { Items = [] } = await paginateQuery(this.dynamoDb, query)
    return Items.map(({ header }) => header)
  }

  public async getListHeader(listId: string): Promise<ListHeader | null> {
    if (listId.length > 1024) {
      // Bad list ID. 1024 is the maximum length of a DynamoDB sort key bytes
      return null
    }
    const { Item } = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Key: DynamoDbKeys.LIST_HEADER(this.tenantId, listId),
        ConsistentRead: true,
      })
    )
    if (Item == null) {
      return null
    }
    const { header } = Item
    return header
  }

  public async updateListHeader(listHeader: ListHeader): Promise<void> {
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
        Item: {
          ...DynamoDbKeys.LIST_HEADER(this.tenantId, listHeader.listId),
          header: listHeader,
        },
      })
    )
  }

  private async refreshListHeader(listHeader: ListHeader): Promise<void> {
    await this.updateListHeader({
      ...listHeader,
      size: await this.countListValues(listHeader.listId),
    })
  }

  public async getListItem(
    listId: string,
    key: string
  ): Promise<ListItem | null> {
    const header = await this.getListHeader(listId)
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

  public async setListItem(listId: string, listItem: ListItem) {
    const header = await this.getListHeader(listId)
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

  public async deleteListItem(listId: string, key: string) {
    const header = await this.getListHeader(listId)
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

  public async updateListItems(listId: string, listItems: ListItem[]) {
    const header = await this.getListHeader(listId)
    if (header == null) {
      throw new Error(`List doesn't exist`)
    }
    const map: { [key: string]: BatchWriteRequestInternal } = {}

    for (const item of listItems) {
      map[item.key] = {
        PutRequest: {
          Item: {
            ...DynamoDbKeys.LIST_ITEM(this.tenantId, listId, item.key),
            ...item,
          },
        } as PutRequestInternal,
      }
    }

    await batchWrite(
      this.dynamoDb,
      Object.values(map),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
    await this.refreshListHeader(header)
  }

  public async getListItems(
    listId: string,
    params?: Pick<CursorPaginationParams, 'fromCursorKey' | 'pageSize'>
  ): Promise<CursorPaginationResponse<ListItem>> {
    const pageSize = params?.pageSize ?? DEFAULT_PAGE_SIZE
    const queryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.LIST_ITEM(this.tenantId, listId, '').PartitionKeyID,
      },
      ExclusiveStartKey: params?.fromCursorKey
        ? DynamoDbKeys.LIST_ITEM(this.tenantId, listId, params?.fromCursorKey)
        : undefined,
      Limit: pageSize + 1,
    }
    const { Items = [], LastEvaluatedKey } = await this.dynamoDb.send(
      new QueryCommand(queryCommandInput)
    )
    let prev = ''
    let hasPrev = false
    if (params?.fromCursorKey) {
      const { Items = [] } = await this.dynamoDb.send(
        new QueryCommand({
          ...queryCommandInput,
          ScanIndexForward: false,
        })
      )
      hasPrev = Items.length > 0
      prev = Items.length === pageSize + 1 ? Items[Items.length - 2].key : ''
    }
    const items: ListItem[] = Items.slice(0, pageSize).map(
      ({ key, metadata }) => ({
        key,
        metadata,
      })
    )
    const [nextPageFirstItem] = Items.slice(pageSize)
    const hasNextPage = nextPageFirstItem != null

    const count = await this.countListValues(listId)
    return {
      next:
        hasNextPage && LastEvaluatedKey != null && items.length > 0
          ? items[items.length - 1].key
          : '',
      prev: prev,
      hasNext: hasNextPage,
      hasPrev,
      count: count,
      limit: 10000,
      last: '',
      pageSize: pageSize,
      items,
    }
  }

  public async countListValues(listId: string): Promise<number> {
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

  public async match(
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
}
