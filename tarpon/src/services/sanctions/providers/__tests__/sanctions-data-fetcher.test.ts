import { MongoClient, Collection } from 'mongodb'
import { intersection, sample } from 'lodash'
import { SanctionsDataFetcher } from '../sanctions-data-fetcher'
import data from './ongoing_search_results.json'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { SanctionsProviderResponse } from '@/services/sanctions/providers/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getContext } from '@/core/utils/context'
import {
  SANCTIONS_COLLECTION,
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { calculateLevenshteinDistancePercentage } from '@/utils/search'

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

  test('in memory search should return results - 1', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()
    const searchTerm = 'Amir Bin Mohamed'
    const fuzzinessRange = {
      lowerBound: 1,
      upperBound: 50,
    }
    const yearOfBirth = 1965
    const documentId = ['650724015035']
    const searchResult = await sanctionsFetcher.searchInMemory({
      searchTerm,
      types: ['ADVERSE_MEDIA'],
      fuzzinessRange,
      yearOfBirth,
      documentId,
    })
    searchResult.data?.forEach((result) => {
      const differencePercentage =
        100 -
        calculateLevenshteinDistancePercentage(
          searchTerm,
          result.name.toLowerCase()
        )
      expect(differencePercentage).toBeLessThan(fuzzinessRange.upperBound)
      expect(true).toEqual(
        String(yearOfBirth) === result.yearOfBirth ||
          result.yearOfBirth === undefined
      )
      const resultDocumentIds =
        result.documents?.map((doc) => doc.formattedId) ?? []
      console.log(resultDocumentIds)
      expect(documentId.every((id) => resultDocumentIds.includes(id))).toBe(
        true
      )
      expect(result.sanctionSearchTypes?.includes('ADVERSE_MEDIA')).toBe(true)
    })
  })

  test('in memory search should return results - 2', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()
    const searchTerm = 'John Doe'
    const fuzzinessRange = {
      lowerBound: 1,
      upperBound: 50,
    }
    const searchResult = await sanctionsFetcher.searchInMemory({
      searchTerm,
      types: ['ADVERSE_MEDIA'],
      fuzzinessRange,
    })
    expect(searchResult.data?.length).toBe(0)
  })

  test('in memory search should return results - 3', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()
    const searchTerm = 'Hassan Bin Abdul Karim'
    const fuzzinessRange = {
      lowerBound: 1,
      upperBound: 15,
    }
    const PEPRank = 'LEVEL_1'
    const yearOfBirth = 1951
    const searchResult = await sanctionsFetcher.searchInMemory({
      searchTerm,
      types: ['PEP'],
      fuzzinessRange,
      PEPRank,
      yearOfBirth,
    })
    searchResult.data?.forEach((result) => {
      const differencePercentage =
        100 -
        calculateLevenshteinDistancePercentage(
          searchTerm,
          result.name.toLowerCase()
        )
      expect(differencePercentage).toBeLessThan(fuzzinessRange.upperBound)
      expect(true).toEqual(
        String(yearOfBirth) === result.yearOfBirth ||
          result.yearOfBirth === undefined
      )
      expect(
        result.occupations?.some((occupation) => occupation.rank === PEPRank)
      ).toBe(true)
      expect(result.sanctionSearchTypes?.includes('PEP')).toBe(true)
    })
  })

  test('in memory search should return results - 4', async () => {
    const sanctionsFetcher = new TestSanctionsDataFetcher()
    const searchTerm = 'Mohd Nasir Ahmad'
    const fuzzinessRange = {
      lowerBound: 1,
      upperBound: 10,
    }
    const PEPRank = 'LEVEL_2'
    const searchResult = await sanctionsFetcher.searchInMemory({
      searchTerm,
      types: ['PEP'],
      fuzzinessRange,
      PEPRank,
    })
    searchResult.data?.forEach((result) => {
      const differencePercentage =
        100 -
        calculateLevenshteinDistancePercentage(
          searchTerm,
          result.name.toLowerCase()
        )
      expect(differencePercentage).toBeLessThan(fuzzinessRange.upperBound)
      expect(
        result.occupations?.some((occupation) => occupation.rank === PEPRank)
      ).toBe(true)
      expect(result.sanctionSearchTypes?.includes('PEP')).toBe(true)
    })

    const searchResult2 = await sanctionsFetcher.searchInMemory({
      searchTerm,
      types: ['PEP'],
      fuzzinessRange,
      PEPRank: 'LEVEL_1',
    })
    expect(searchResult2.data?.length).toBe(0)
  })

  test('search should return results with 100 fuzziness', async () => {
    const screeningEntities = data
      .map((entity) => JSON.parse(entity.data))
      .filter(
        (entity) =>
          entity.documents?.length && entity.sanctionSearchTypes?.length
      )
      .slice(0, 10)

    await sanctionsCollection.insertMany(screeningEntities)

    const randomEntity1 = sample(screeningEntities)
    const sanctionsFetcher = new TestSanctionsDataFetcher()
    const searchResult1 = await sanctionsFetcher.searchWithoutMatchingNames({
      searchTerm: randomEntity1.name,
      documentId: randomEntity1.documents?.map((doc) => doc.formattedId),
      types: randomEntity1.sanctionSearchTypes,
      allowDocumentMatches: true,
    })
    expect(searchResult1.data?.length).toBeGreaterThan(0)
    const resultDocumentIds = searchResult1.data?.map((result) =>
      result.documents?.map((doc) => doc.formattedId)
    )
    expect(
      resultDocumentIds?.every(
        (ids) =>
          intersection(
            ids,
            randomEntity1.documents?.map((doc) => doc.formattedId)
          ).length > 0
      )
    ).toBe(true)
    expect(
      searchResult1.data?.every(
        (result) =>
          intersection(
            result.sanctionSearchTypes,
            randomEntity1.sanctionSearchTypes
          ).length > 0
      )
    ).toBe(true)

    const randomEntity2 = sample(screeningEntities)
    const searchResult2 = await sanctionsFetcher.searchWithoutMatchingNames({
      searchTerm: randomEntity2.name,
      documentId: randomEntity2.documents?.map((doc) => doc.formattedId),
      types: randomEntity2.sanctionSearchTypes,
      allowDocumentMatches: true,
    })
    expect(searchResult2.data?.length).toBeGreaterThan(0)
    const resultDocumentIds2 = searchResult2.data?.map((result) =>
      result.documents?.map((doc) => doc.formattedId)
    )
    expect(
      resultDocumentIds2?.every(
        (ids) =>
          intersection(
            ids,
            randomEntity2.documents?.map((doc) => doc.formattedId)
          ).length > 0
      )
    ).toBe(true)
    expect(
      searchResult2.data?.every(
        (result) =>
          intersection(
            result.sanctionSearchTypes,
            randomEntity2.sanctionSearchTypes
          ).length > 0
      )
    ).toBe(true)

    const searchResult3 = await sanctionsFetcher.searchWithoutMatchingNames({
      searchTerm: 'Rajesh Kumar',
      documentId: ['test-to-not-match'],
      types: ['ADVERSE_MEDIA'],
      allowDocumentMatches: true,
    })
    expect(searchResult3.data?.length).toBe(0)
  })
})
