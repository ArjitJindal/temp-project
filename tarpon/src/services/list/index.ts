import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { NotFound } from 'http-errors'
import { ListRepository } from './repositories/list-repository'
import { ListType } from '@/@types/openapi-public/ListType'
import { ListSubtype } from '@/@types/openapi-public/ListSubtype'
import { ListData } from '@/@types/openapi-public/ListData'
import { ListExisted } from '@/@types/openapi-public/ListExisted'
import { ListHeader } from '@/@types/openapi-public/ListHeader'
import { ListItem } from '@/@types/openapi-public/ListItem'
import { traceable } from '@/core/xray'
import {
  CursorPaginationParams,
  CursorPaginationResponse,
} from '@/utils/pagination'

@traceable
export class ListService {
  listRepository: ListRepository

  constructor(
    tenantId: string,
    connections: { dynamoDb: DynamoDBDocumentClient }
  ) {
    this.listRepository = new ListRepository(tenantId, connections.dynamoDb)
  }
  public async createList(
    listType: ListType,
    subtype: ListSubtype,
    newList: ListData = {},
    mannualListId?: string
  ): Promise<ListExisted> {
    return await this.listRepository.createList(
      listType,
      subtype,
      newList,
      mannualListId
    )
  }

  public async setListItem(listId: string, item: ListItem): Promise<void> {
    return await this.listRepository.setListItem(listId, item)
  }

  public async deleteListItem(listId: string, itemId: string): Promise<void> {
    return await this.listRepository.deleteListItem(listId, itemId)
  }

  public async deleteList(listId: string) {
    return await this.listRepository.deleteList(listId)
  }

  public async getListHeaders(
    listType: ListType | null = null
  ): Promise<ListHeader[]> {
    return await this.listRepository.getListHeaders(listType)
  }

  public async getListHeader(listId: string): Promise<ListHeader | null> {
    const list = await this.listRepository.getListHeader(listId)
    if (list === null) {
      throw new NotFound(`List not found: ${listId}`)
    }
    return list
  }

  public async updateListHeader(list: ListHeader): Promise<void> {
    return await this.listRepository.updateListHeader(list)
  }

  public async updateListItems(
    listId: string,
    items: ListItem[]
  ): Promise<void> {
    return await this.listRepository.updateListItems(listId, items)
  }

  public async getListItems(
    listId: string,
    params?: Pick<CursorPaginationParams, 'fromCursorKey' | 'pageSize'>
  ): Promise<CursorPaginationResponse<ListItem>> {
    return await this.listRepository.getListItems(listId, params)
  }
}
