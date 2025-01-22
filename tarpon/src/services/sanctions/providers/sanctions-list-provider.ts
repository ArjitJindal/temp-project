import {
  SanctionsDataProvider,
  SanctionsProviderResponse,
} from '@/services/sanctions/providers/types'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { SanctionsProviderSearchRepository } from '@/services/sanctions/repositories/sanctions-provider-searches-repository'
import { ListRepository } from '@/services/list/repositories/list-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ListItem } from '@/@types/openapi-public/ListItem'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { traceable } from '@/core/xray'

const cachedLists: Map<string, [Date, ListItem[]]> = new Map()

@traceable
export class SanctionsListProvider implements SanctionsDataProvider {
  private readonly providerName: SanctionsDataProviderName
  private readonly searchRepository: SanctionsProviderSearchRepository
  private readonly listId: string
  private readonly tenantId: string
  private readonly listRepository: ListRepository

  static async build(tenantId: string, listId: string) {
    const listRepository = new ListRepository(tenantId, getDynamoDbClient())
    return new SanctionsListProvider('list', listId, tenantId, listRepository)
  }

  constructor(
    provider: SanctionsDataProviderName,
    listId: string,
    tenantId: string,
    listRepository: ListRepository
  ) {
    this.providerName = provider
    this.searchRepository = new SanctionsProviderSearchRepository()
    this.listRepository = listRepository
    this.listId = listId
    this.tenantId = tenantId
  }

  private async loadList(): Promise<ListItem[]> {
    let listCursor = await this.listRepository.getListItems(this.listId)
    const allItems: ListItem[] = []
    allItems.push(...listCursor.items)
    while (listCursor.hasNext) {
      listCursor = await this.listRepository.getListItems(this.listId, {
        fromCursorKey: listCursor.next,
      })
      allItems.push(...listCursor.items)
    }
    return allItems
  }

  private async resolveList(): Promise<ListItem[]> {
    const key = `${this.tenantId}-${this.listId}`
    if (cachedLists.has(key)) {
      const value = cachedLists.get(key)
      if (value) {
        const [dateAdded, items] = value
        const twentySecondsAgo = Date.now() - 1000 * 20
        if (dateAdded.getTime() >= twentySecondsAgo) {
          return items
        }
      }
    }
    const items = await this.loadList()
    cachedLists.set(key, [new Date(), items])
    return items
  }

  async search(
    request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    const list = await this.resolveList()
    const matchingItems = list.filter((item) => {
      const similarity = calculateLevenshteinDistancePercentage(
        request.searchTerm,
        item.key
      )
      const distance = 100 - similarity

      if (
        request.fuzzinessRange?.lowerBound &&
        distance < request.fuzzinessRange?.lowerBound
      ) {
        return false
      }
      if (
        request.fuzzinessRange?.upperBound &&
        distance > request.fuzzinessRange?.upperBound
      ) {
        return false
      }

      // Specific for PNB, match document ID against the "reason" in the list,
      // which will be the NRIC.
      return request.documentId && item.metadata?.reason
        ? request.documentId.includes(item.metadata.reason)
        : true
    })
    const filteredResults = matchingItems.map((i): SanctionsEntity => {
      return {
        entityType: 'PERSON',
        id: i.key,
        name: i.key,
      }
    })
    return this.searchRepository.saveSearch(filteredResults, request)
  }

  provider(): SanctionsDataProviderName {
    return this.providerName
  }

  async getSearch(
    providerSearchId: string
  ): Promise<SanctionsProviderResponse> {
    return this.searchRepository.getSearchResult(providerSearchId)
  }

  async deleteSearch(providerSearchId: string): Promise<void> {
    await this.searchRepository.deleteSearchResult(providerSearchId)
  }

  async setMonitoring(
    providerSearchId: string,
    monitor: boolean
  ): Promise<void> {
    await this.searchRepository.setMonitoring(providerSearchId, monitor)
  }
}
