import { StackConstants } from '@lib/constants'
import { v4 as uuidv4 } from 'uuid'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import createHttpError from 'http-errors'
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
import { ListMetadataTtl } from '@/@types/openapi-public/ListMetadataTtl'

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
      size: metadata?.ttl ? undefined : items.length,
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
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Item: {
          ...DynamoDbKeys.LIST_DELETED(this.tenantId, listId),
          header,
        },
      })
    )
    await this.dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: DynamoDbKeys.LIST_HEADER(this.tenantId, listId),
      })
    )
  }

  public async clearListItems(listId: string) {
    const header = await this.getListHeader(listId)
    if (header == null) {
      throw new createHttpError.NotFound(`List ${listId} not found`)
    }
    const updatedHeader: ListHeader = {
      ...header,
      version: (header.version ?? 0) + 1,
    }
    await this.refreshListHeader(updatedHeader)
  }

  public async getListHeaders(
    listType: ListType | null = null,
    userIds?: string[]
  ): Promise<ListHeader[]> {
    const primaryKey = DynamoDbKeys.LIST_HEADER(this.tenantId, '')
    const filterConditions: string[] = []
    const expressionAttributeValues: Record<string, any> = {
      ':pk': primaryKey.PartitionKeyID,
    }
    const expressionAttributeNames: Record<string, string> = {}

    if (listType != null) {
      filterConditions.push('header.listType = :listType')
      expressionAttributeValues[':listType'] = listType
    }

    if (userIds && userIds.length > 0) {
      filterConditions.push('header.#st = :subtype')
      expressionAttributeValues[':subtype'] = 'USER_ID'
      expressionAttributeNames['#st'] = 'subtype'
    }

    const query = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression:
        filterConditions.length > 0
          ? filterConditions.join(' AND ')
          : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames:
        Object.keys(expressionAttributeNames).length > 0
          ? expressionAttributeNames
          : undefined,
    }

    const { Items = [] } = await paginateQuery(this.dynamoDb, query)

    const headers = await Promise.all(
      Items.map(async ({ header }) => {
        if (header.metadata?.ttl) {
          header.size = await this.countListValues(
            header.listId,
            header.version
          )
        }
        return header
      })
    )

    if (!userIds || userIds.length === 0) {
      return headers
    }

    // Filter headers by checking if any of the userIds exist in the list items
    const filteredHeaders = await Promise.all(
      headers.map(async (header) => {
        for (const userId of userIds) {
          const item = await this.getListItem(header.listId, userId)
          if (item !== null) {
            return header
          }
        }
        return null
      })
    )

    return filteredHeaders.filter(
      (header): header is ListHeader => header !== null
    )
  }

  public async getListHeader(listId: string): Promise<ListHeader | null> {
    if (listId.length > 1024) {
      // Bad list ID. 1024 is the maximum length of a DynamoDB sort key bytes
      return null
    }
    const { Item } = await this.dynamoDb.send(
      new GetCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: DynamoDbKeys.LIST_HEADER(this.tenantId, listId),
        ConsistentRead: true,
      })
    )
    if (Item == null) {
      return null
    }
    const { header } = Item

    // If TTL is configured, compute size on the fly
    if (header.metadata?.ttl) {
      header.size = await this.countListValues(header.listId, header.version)
    }

    return header
  }

  public async updateListHeader(listHeader: ListHeader): Promise<void> {
    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Item: {
          ...DynamoDbKeys.LIST_HEADER(this.tenantId, listHeader.listId),
          header: listHeader,
        },
      })
    )
  }

  private async refreshListHeader(listHeader: ListHeader): Promise<void> {
    if (listHeader.metadata?.ttl) {
      return
    }
    await this.updateListHeader({
      ...listHeader,
      size: await this.countListValues(listHeader.listId, listHeader.version),
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

    const currentTimestamp = Math.floor(Date.now() / 1000)

    const { Items = [] } = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk AND SortKeyID = :sk',
        FilterExpression:
          'attribute_not_exists(#ttl) OR #ttl = :null OR #ttl >= :currentTimestamp',
        ExpressionAttributeNames: {
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.LIST_ITEM(
            this.tenantId,
            listId,
            header.version,
            key
          ).PartitionKeyID,
          ':sk': DynamoDbKeys.LIST_ITEM(
            this.tenantId,
            listId,
            header.version,
            key
          ).SortKeyID,
          ':currentTimestamp': currentTimestamp,
          ':null': null,
        },
      })
    )

    const Item = Items.length === 1 ? Items[0] : null
    if (Item == null) {
      return null
    }
    return { key: Item.key, metadata: Item.metadata }
  }

  public async setListItem(listId: string, listItem: ListItem) {
    await this.setListItems(listId, [listItem])
  }

  public async setListItems(listId: string, listItems: ListItem[]) {
    const header = await this.getListHeader(listId)
    if (header == null) {
      throw new Error(`List doesn't exist`)
    }

    // if list has a default TTL we need to set the ttl field in every item
    const listTTL: ListMetadataTtl | undefined = header.metadata?.ttl
    if (listTTL) {
      const itemsExpireAt = computeItemExpireAt(listTTL)
      listItems.forEach((item) => {
        item.ttl = itemsExpireAt
      })
    }

    const requests: BatchWriteRequestInternal[] = listItems.map((listItem) => ({
      PutRequest: {
        Item: {
          ...DynamoDbKeys.LIST_ITEM(
            this.tenantId,
            listId,
            header.version,
            listItem.key
          ),
          ...listItem,
        },
      },
    }))
    await batchWrite(
      this.dynamoDb,
      requests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
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
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: DynamoDbKeys.LIST_ITEM(this.tenantId, listId, header.version, key),
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

    // if list has a default TTL we need to set the ttl field in every item
    const listTTL: ListMetadataTtl | undefined = header.metadata?.ttl
    if (listTTL) {
      const itemsExpireAt = computeItemExpireAt(listTTL)
      listItems.forEach((item) => {
        item.ttl = itemsExpireAt
      })
    }

    for (const item of listItems) {
      map[item.key] = {
        PutRequest: {
          Item: {
            ...DynamoDbKeys.LIST_ITEM(
              this.tenantId,
              listId,
              header.version,
              item.key
            ),
            ...item,
          },
        } as PutRequestInternal,
      }
    }

    await batchWrite(
      this.dynamoDb,
      Object.values(map),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )
    await this.refreshListHeader(header)
  }

  public async getListItems(
    listId: string,
    params?: Pick<CursorPaginationParams, 'fromCursorKey' | 'pageSize'>,
    version?: number,
    ignoreCount: boolean = false
  ): Promise<CursorPaginationResponse<ListItem>> {
    let requestedVersion = version
    if (!requestedVersion) {
      const header = await this.getListHeader(listId)
      if (header == null) {
        throw new createHttpError.NotFound(`List ${listId} not found`)
      }
      requestedVersion = header.version
    }
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const pageSize = params?.pageSize ?? DEFAULT_PAGE_SIZE

    const queryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression:
        'attribute_not_exists(#ttl) OR #ttl = :null OR #ttl >= :currentTimestamp',
      ExpressionAttributeNames: {
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.LIST_ITEM(this.tenantId, listId, requestedVersion)
          .PartitionKeyID,
        ':currentTimestamp': currentTimestamp,
        ':null': null,
      },
      ExclusiveStartKey: params?.fromCursorKey
        ? DynamoDbKeys.LIST_ITEM(
            this.tenantId,
            listId,
            requestedVersion,
            params?.fromCursorKey
          )
        : undefined,
      Limit: pageSize + 1,
    }
    const { Items = [] } = await this.dynamoDb.send(
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

    const count = ignoreCount
      ? 0
      : await this.countListValues(listId, requestedVersion)

    return {
      next:
        hasNextPage && items.length === pageSize
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

  public async countListValues(
    listId: string,
    version?: number
  ): Promise<number> {
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const { Count } = await paginateQuery(this.dynamoDb, {
      Select: 'COUNT',
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression:
        'attribute_not_exists(#ttl) OR #ttl = :null OR #ttl >= :currentTimestamp',
      ExpressionAttributeNames: {
        '#ttl': 'ttl',
      },
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.LIST_ITEM(this.tenantId, listId, version)
          .PartitionKeyID,
        ':currentTimestamp': currentTimestamp,
        ':null': null,
      },
    })
    return Count ?? 0
  }

  public async match(
    listHeader: ListHeader,
    value: string,
    method: 'EXACT' | 'PREFIX' | 'CONTAINS'
  ): Promise<boolean> {
    const { listId, version } = listHeader
    const key = DynamoDbKeys.LIST_ITEM(this.tenantId, listId, version, value)
    const currentTimestamp = Math.floor(Date.now() / 1000)
    let KeyConditionExpression: string
    if (method === 'EXACT') {
      KeyConditionExpression = 'PartitionKeyID = :pk AND SortKeyID = :sk'
    } else if (method === 'PREFIX') {
      KeyConditionExpression =
        'PartitionKeyID = :pk AND begins_with ( SortKeyID, :sk )'
    } else if (method === 'CONTAINS') {
      KeyConditionExpression = 'PartitionKeyID = :pk'
    } else {
      KeyConditionExpression = neverReturn(method, 'PartitionKeyID = :pk')
    }
    const { Items = [] } = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression,
        FilterExpression: `(attribute_not_exists(#ttl) OR #ttl = :null OR #ttl >= :currentTimestamp) ${
          method === 'CONTAINS' ? 'AND contains ( #key, :sk )' : ''
        }`,
        ExpressionAttributeNames: {
          '#ttl': 'ttl',
          ...(method === 'CONTAINS' ? { '#key': 'key' } : {}),
        },
        ExpressionAttributeValues: {
          ':pk': key.PartitionKeyID,
          ':sk': key.SortKeyID,
          ':currentTimestamp': currentTimestamp,
          ':null': null,
        },
        ...(method !== 'CONTAINS' ? { Limit: 1 } : {}),
      })
    )
    return Items.length > 0
  }
}

const computeItemExpireAt = (ttl: ListMetadataTtl) => {
  // compute the expiration of the items in seconds
  let secondsTTL: number
  switch (ttl.unit) {
    case 'HOUR':
      secondsTTL = ttl.value * 3600
      break
    case 'DAY':
      secondsTTL = ttl.value * 86400
      break
    default:
      throw new Error(`Unsupported TTL unit: ${ttl.unit}`)
  }
  const itemsExpireAt = Math.floor(Date.now() / 1000 + secondsTTL)
  return itemsExpireAt
}
