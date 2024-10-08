import { SanctionsService } from '..'
import { SanctionsSearchRepository } from '../repositories/sanctions-search-repository'
import { MOCK_SEARCH_1794517025_DATA } from '@/test-utils/resources/mock-ca-search-response'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { mockComplyAdvantageSearch } from '@/test-utils/complyadvantage-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { SanctionsHitsRepository } from '@/services/sanctions/repositories/sanctions-hits-repository'
import { SANCTIONS_SEARCHES_COLLECTION } from '@/utils/mongodb-definitions'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import {
  complyAdvantageDocToEntity,
  convertComplyAdvantageEntityToHit,
} from '@/services/sanctions/providers/comply-advantage-provider'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'

const mockFetch = mockComplyAdvantageSearch()
dynamoDbSetupHook()

const totalMockHitsCount = MOCK_SEARCH_1794517025_DATA.entities.reduce(
  (acc, x) => acc + x.content.length,
  0
)

describe('Sanctions Service', () => {
  const TEST_TENANT_ID = getTestTenantId()
  let testSearchId = ''

  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('Search', () => {
    test('Search CA and persist the result', async () => {
      const service = new SanctionsService(TEST_TENANT_ID)
      const request: SanctionsSearchRequest = {
        searchTerm: '  fOO   Bar  ',
        fuzziness: 0.5,
        countryCodes: ['DE', 'FR'],
        yearOfBirth: 1992,
        types: ['SANCTIONS', 'PEP'],
        monitoring: { enabled: true },
      }
      const response = await service.search(request)
      testSearchId = response.searchId
      // 1 for creating new search
      // 5 for paginating entities
      // 1 for updating monitoring state
      expect(mockFetch).toBeCalledTimes(1 + 5 + 1)
      expect(mockFetch.mock.calls[0]).toEqual([
        `https://api.complyadvantage.com/searches`,
        {
          headers: {
            Authorization: 'Token fake',
          },
          body: JSON.stringify({
            search_term: 'Foo Bar',
            fuzziness: 0.5,
            search_profile: '65032c2f-d579-4ef6-8464-c8fbe9df11bb',
            filters: { country_codes: ['DE', 'FR'], birth_year: 1992 },
          }),
          method: 'POST',
        },
      ])
      expect(mockFetch.mock.calls[mockFetch.mock.calls.length - 1]).toEqual([
        `https://api.complyadvantage.com/searches/1794517025/monitors`,
        {
          headers: {
            Authorization: 'Token fake',
          },
          body: JSON.stringify({
            is_monitored: true,
          }),
          method: 'PATCH',
        },
      ])
      expect(await service.getSearchHistory(response.searchId)).toEqual({
        _id: response.searchId,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
        request,
        response: response,
      })
    })

    describe('Getting existed searches', () => {
      test('It should hit the cache when searching with fuzinessRange and it is not defined in original search', async () => {
        const service = new SanctionsService(TEST_TENANT_ID)
        const request1: SanctionsSearchRequest = {
          searchTerm: 'Putin',
          fuzziness: 0.5,
          countryCodes: ['DE', 'FR'],
          yearOfBirth: 1992,
          types: ['SANCTIONS', 'PEP'],
          monitoring: { enabled: true },
        }
        const response1 = await service.search(request1)
        const searchId1 = response1.searchId

        const request2: SanctionsSearchRequest = {
          ...request1,
          fuzzinessRange: {
            lowerBound: 42,
            upperBound: 100,
          },
        }
        const response2 = await service.search(request2)
        const searchId2 = response2.searchId
        expect(searchId1).toEqual(searchId2)
      })
      test('It should hit the cache when searching with fuzzinessRange and it is matched in original search', async () => {
        const service = new SanctionsService(TEST_TENANT_ID)
        const request1: SanctionsSearchRequest = {
          searchTerm: 'Putin 2',
          fuzzinessRange: {
            lowerBound: 42,
            upperBound: 100,
          },
          countryCodes: ['DE', 'FR'],
          yearOfBirth: 1992,
          types: ['SANCTIONS', 'PEP'],
          monitoring: { enabled: true },
        }
        const response1 = await service.search(request1)
        const searchId1 = response1.searchId

        const request2: SanctionsSearchRequest = {
          ...request1,
          fuzzinessRange: {
            lowerBound: 42,
            upperBound: 100,
          },
        }
        const response2 = await service.search(request2)
        const searchId2 = response2.searchId
        expect(searchId1).toEqual(searchId2)
      })

      test('It should not hit the cache when searching with fuzzinessRange and it is not matching in original search', async () => {
        const service = new SanctionsService(TEST_TENANT_ID)
        const request1: SanctionsSearchRequest = {
          searchTerm: 'Putin 3',
          fuzzinessRange: {
            lowerBound: 42,
            upperBound: 100,
          },
          countryCodes: ['DE', 'FR'],
          yearOfBirth: 1992,
          types: ['SANCTIONS', 'PEP'],
          monitoring: { enabled: true },
        }
        const response1 = await service.search(request1)
        const searchId1 = response1.searchId

        const request2: SanctionsSearchRequest = {
          ...request1,
          fuzzinessRange: {
            lowerBound: 12,
            upperBound: 72,
          },
        }
        const response2 = await service.search(request2)
        const searchId2 = response2.searchId
        expect(searchId1).not.toEqual(searchId2)
      })
    })

    test('Skip searching CA on cache hit', async () => {
      const service = new SanctionsService(TEST_TENANT_ID)
      const mongoDb = await getMongoDbClient()
      const db = mongoDb.db()
      const collection = db.collection<SanctionsSearchHistory>(
        SANCTIONS_SEARCHES_COLLECTION(TEST_TENANT_ID)
      )

      const request: SanctionsSearchRequest = {
        searchTerm: 'test',
        fuzziness: 0.5,
        countryCodes: ['DE', 'FR'],
        yearOfBirth: 1992,
        types: ['SANCTIONS', 'PEP'],
      }
      await service.search(request)
      const firstSearchCallsCount = mockFetch.mock.calls.length
      const firstSearchDocCount = await collection.countDocuments()
      await service.search(request)
      expect(mockFetch).toBeCalledTimes(firstSearchCallsCount)
      expect(await collection.countDocuments()).toEqual(firstSearchDocCount)
    })

    test('Filter out whitelist entities (global level)', async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const service = new SanctionsService(TEST_TENANT_ID)
      const request: SanctionsSearchRequest = {
        searchTerm: 'test',
        fuzziness: 0.5,
        countryCodes: ['DE', 'FR'],
        yearOfBirth: 1992,
        types: ['SANCTIONS', 'PEP'],
      }
      {
        const response = await service.search(request)
        const hits = await service.createHitsForSearch(response, undefined)
        expect(response.hitsCount).toEqual(totalMockHitsCount)
        expect(hits).toHaveLength(totalMockHitsCount)
      }
      for (const entityList of MOCK_SEARCH_1794517025_DATA.entities) {
        await service.addWhitelistEntities(
          entityList.content.map((ca) =>
            complyAdvantageDocToEntity(convertComplyAdvantageEntityToHit(ca))
          ),
          {}
        )
      }
      {
        const response = await service.search(request)
        const hits = await service.createHitsForSearch(response, undefined)
        expect(response.hitsCount).toEqual(0)
        expect(hits).toHaveLength(0)
      }
    })

    test('Filter out whitelist entities (user level)', async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const service = new SanctionsService(TEST_TENANT_ID)
      const request: SanctionsSearchRequest = {
        searchTerm: 'test',
        fuzziness: 0.5,
        countryCodes: ['DE', 'FR'],
        yearOfBirth: 1992,
        types: ['SANCTIONS', 'PEP'],
      }
      const hitContext1 = {
        ruleInstanceId: 'test',
        userId: 'test-user-id',
      }
      const hitContext2 = {
        ruleInstanceId: 'test',
        userId: 'test-user-id-2',
      }
      {
        const response = await service.search(request, hitContext1)
        expect(response.hitsCount).toEqual(totalMockHitsCount)
        const hits = await service.createHitsForSearch(response, hitContext1)
        expect(hits).toHaveLength(totalMockHitsCount)
      }
      for (const entityList of MOCK_SEARCH_1794517025_DATA.entities) {
        await service.addWhitelistEntities(
          entityList.content.map((ca) =>
            complyAdvantageDocToEntity(convertComplyAdvantageEntityToHit(ca))
          ),
          {
            userId: hitContext1.userId,
          }
        )
      }
      {
        const response = await service.search(request, hitContext1)
        expect(response.hitsCount).toEqual(0)
        const hits = await service.createHitsForSearch(response, hitContext1)
        expect(hits).toHaveLength(0)
      }
      {
        const response = await service.search(request, hitContext2)
        expect(response.hitsCount).toEqual(totalMockHitsCount)
        const hits = await service.createHitsForSearch(response, hitContext2)
        expect(hits).toHaveLength(totalMockHitsCount)
      }
    })
  })

  describe('Update search', () => {
    test('Update CA and persist the result', async () => {
      const service = new SanctionsService(TEST_TENANT_ID)
      await service.updateSearch(testSearchId, {
        enabled: false,
      })
      expect(mockFetch).toBeCalledTimes(1)
      expect(mockFetch.mock.calls[0]).toEqual([
        `https://api.complyadvantage.com/searches/1794517025/monitors`,
        {
          headers: {
            Authorization: 'Token fake',
          },
          body: JSON.stringify({
            is_monitored: false,
          }),
          method: 'PATCH',
        },
      ])
      const sanctionsSearchRepository = new SanctionsSearchRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
      const searchHistory = await sanctionsSearchRepository.getSearchResult(
        testSearchId
      )
      expect(searchHistory?.request.monitoring?.enabled).toBe(false)
    })

    test('Old hits should not be added as new', async () => {
      const repository = new SanctionsHitsRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )
      const rawHits = [...new Array(10)].map(() => ({
        ...SAMPLE_HIT_1,
        id: `${Date.now()}`,
      }))

      const hits = await repository.addHits('test', rawHits, undefined)
      expect(hits).toHaveLength(rawHits.length)

      const newHits = await repository.addNewHits('test', rawHits, undefined)
      expect(newHits).toHaveLength(0)
    })

    test('Old hits entities should be updated properly', async () => {
      const repository = new SanctionsHitsRepository(
        TEST_TENANT_ID,
        await getMongoDbClient()
      )

      const hits = await repository.addHits('test2', [SAMPLE_HIT_1], undefined)
      expect(hits).toHaveLength(1)

      {
        const mergeResult = await repository.mergeHits(
          'test2',
          [SAMPLE_HIT_1],
          undefined
        )
        expect(mergeResult.newIds).toHaveLength(0)
        expect(mergeResult.updatedIds).toHaveLength(1)
      }
      {
        const mergeResult = await repository.mergeHits(
          'test2',
          [
            {
              ...SAMPLE_HIT_1,
              name: 'New name',
            },
            SAMPLE_HIT_2,
          ],
          undefined
        )
        expect(mergeResult.newIds).toHaveLength(1)
        expect(mergeResult.updatedIds).toHaveLength(1)

        const savedHit = await repository.searchHits({
          filterHitIds: [hits[0]?.sanctionsHitId],
        })
        expect(savedHit.count).toEqual(1)
        expect(savedHit.items[0]?.entity.name).toEqual('New name')
      }
    })
  })

  describe('Get search histories', () => {
    test('Get search histories', async () => {
      const service = new SanctionsService(TEST_TENANT_ID)
      const result = await service.getSearchHistories({})
      expect(mockFetch).toBeCalledTimes(0)
      expect(result.count).toBeGreaterThan(0)
      expect(result.items?.length).toBeGreaterThan(0)
    })
  })
})

/*
  Mock data
 */
const SAMPLE_HIT_1: SanctionsEntity = {
  id: 'LIZCQ58HX6MYKMO',
  updatedAt: new Date('2024-06-20T10:09:30Z').getTime(),
  types: ['adverse-media'],
  name: 'Vladimir Putiin',
  entityType: 'person',
  aka: ['Vladimir Putin'],
  sanctionsSources: [
    {
      name: 'company AM',
      countryCodes: ['AU', 'CZ'],
    },
  ],
}

const SAMPLE_HIT_2: SanctionsEntity = {
  id: '999999999999999',
  updatedAt: new Date('2024-06-21T10:09:30Z').getTime(),
  types: ['adverse-media'],
  name: 'Genadiy Zuganov',
  entityType: 'person',
  aka: ['Genadiy Zuganov'],
  sanctionsSources: [
    {
      countryCodes: ['AU', 'CZ'],
      name: 'company AM',
    },
  ],
}
