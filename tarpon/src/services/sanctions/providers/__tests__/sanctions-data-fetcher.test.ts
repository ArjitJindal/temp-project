import { MongoClient, Collection } from 'mongodb'
import { SanctionsDataFetcher } from '../sanctions-data-fetcher'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsProviderResponse } from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context'
import {
  SANCTIONS_COLLECTION,
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'

// Mock getContext
jest.mock('@/core/utils/context', () => ({
  getContext: jest.fn(),
}))

// Extend the SanctionsDataFetcher for testing purposes
class TestSanctionsDataFetcher extends SanctionsDataFetcher {
  constructor() {
    super('dowjones')
  }
  // Implement abstract methods as no-op for this test
  async fullLoad() {}
  async delta() {}

  // Mock the `search` function since $search is only available on Mongo Atlas
  async search(
    _request: SanctionsSearchRequest
  ): Promise<SanctionsProviderResponse> {
    return {
      providerSearchId: 'mock-provider-id',
      hitsCount: 1,
      data: [
        {
          id: '4',
          entityType: 'person',
          name: 'John Doe',
          countryCodes: ['US'],
          yearOfBirth: '1980',
        },
      ],
      createdAt: new Date().getTime(),
    }
  }
}

describe('SanctionsDataFetcher Integration Tests', () => {
  let client: MongoClient
  let sanctionsCollection: Collection<SanctionsEntity>
  let searchCollection: Collection<SanctionsProviderResponse>

  beforeAll(async () => {
    ;(getContext as jest.Mock).mockReturnValue({ tenantId: 'test-tenant' })

    // Start in-memory MongoDB instance
    client = await getMongoDbClient()
    const db = client.db()

    sanctionsCollection = db.collection(SANCTIONS_COLLECTION)
    searchCollection = db.collection(
      SANCTIONS_PROVIDER_SEARCHES_COLLECTION('test-tenant')
    )

    // Seed some data
    await sanctionsCollection.insertMany([
      {
        id: '1',
        entityType: 'person',
        name: 'John Doe',
        countryCodes: ['US'],
        yearOfBirth: '1980',
      },
      {
        id: '1',
        entityType: 'person',
        name: 'Jane Smith',
        countryCodes: ['GB'],
        yearOfBirth: '1985',
      },
    ])
  })

  afterAll(async () => {
    await sanctionsCollection.drop()
  })

  test('getSearch should return stored search result', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()

    const providerSearchId = 'test-provider-id'

    // Manually insert a search result to simulate a stored search
    await searchCollection.insertOne({
      providerSearchId,
      hitsCount: 1,
      data: [{ id: '4', entityType: 'person', name: 'Jane Smith' }],
      createdAt: new Date().getTime(),
    })

    const searchResult = await sanctionsFetcher.getSearch(providerSearchId)
    expect(searchResult.providerSearchId).toBe(providerSearchId)
    expect(searchResult.data && searchResult.data[0].name).toBe('Jane Smith')
  })

  test('deleteSearch should remove the search from the collection', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()

    const providerSearchId = 'delete-test-id'
    await searchCollection.insertOne({
      providerSearchId,
      hitsCount: 1,
      data: [{ id: '7', entityType: 'person', name: 'John Doe' }],
      createdAt: new Date().getTime(),
    })

    // Verify it exists
    const searchResult = await sanctionsFetcher.getSearch(providerSearchId)
    expect(searchResult.providerSearchId).toBe(providerSearchId)

    // Delete the search
    await sanctionsFetcher.deleteSearch(providerSearchId)

    // Verify it no longer exists
    await expect(sanctionsFetcher.getSearch(providerSearchId)).rejects.toThrow(
      `Search not found for ${providerSearchId}`
    )
  })

  test('setMonitoring should update the monitoring field', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()

    const providerSearchId = 'monitoring-test-id'
    await searchCollection.insertOne({
      providerSearchId,
      hitsCount: 1,
      data: [{ id: '30', entityType: 'person', name: 'Jane Smith' }],
      createdAt: new Date().getTime(),
      monitor: false,
    })

    // Set monitoring to true
    await sanctionsFetcher.setMonitoring(providerSearchId, true)

    const updatedSearch = await searchCollection.findOne({ providerSearchId })
    expect(updatedSearch?.monitor).toBe(true)
  })

  test('updateMonitoredSearches should trigger searches for monitored items', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()

    // Insert a monitored search
    await searchCollection.insertOne({
      providerSearchId: 'monitored-search',
      monitor: true,
      request: {
        searchTerm: 'John Doe',
        countryCodes: ['US'],
        yearOfBirth: 1980,
      },
      hitsCount: 0,
      data: [],
      createdAt: new Date().getTime(),
    })

    const searchSpy = jest.spyOn(sanctionsFetcher, 'search')
    await sanctionsFetcher.updateMonitoredSearches()

    expect(searchSpy).toHaveBeenCalled()
    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerm: 'John Doe',
        existingProviderId: 'monitored-search',
      })
    )
  })
})
