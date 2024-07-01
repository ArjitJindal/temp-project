import { SanctionsService, convertEntityToHit } from '..'
import { SanctionsSearchRepository } from '../repositories/sanctions-search-repository'
import { MOCK_SEARCH_1794517025_DATA } from '@/test-utils/resources/mock-ca-search-response'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { mockComplyAdvantageSearch } from '@/test-utils/complyadvantage-test-utils'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { fromAsync } from '@/utils/array'

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
      const hits = await fromAsync(
        service.sanctionsHitsRepository.iterateHits({
          filterSearchId: [response.searchId],
        })
      )
      testSearchId = response.searchId
      expect(
        response.rawComplyAdvantageResponse?.content?.data?.hits
      ).toHaveLength(totalMockHitsCount)
      expect(response).toMatchObject({
        hitsCount: hits.length,
        searchId: expect.any(String),
      })
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

    test('Skip searching CA on cache hit', async () => {
      const service = new SanctionsService(TEST_TENANT_ID)
      const request: SanctionsSearchRequest = {
        searchTerm: 'test',
        fuzziness: 0.5,
        countryCodes: ['DE', 'FR'],
        yearOfBirth: 1992,
        types: ['SANCTIONS', 'PEP'],
      }
      await service.search(request)
      const firstSearchCallsCount = mockFetch.mock.calls.length
      await service.search(request)
      expect(mockFetch).toBeCalledTimes(firstSearchCallsCount)
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
        expect(response.hitsCount).toEqual(totalMockHitsCount)
        const hitsCount = await service.sanctionsHitsRepository.countHits({
          filterSearchId: [response.searchId],
        })
        expect(hitsCount).toEqual(totalMockHitsCount)
      }
      for (const entityList of MOCK_SEARCH_1794517025_DATA.entities) {
        await service.addWhitelistEntities(
          entityList.content.map(
            (v) => convertEntityToHit(v).doc
          ) as any as ComplyAdvantageSearchHitDoc[]
        )
      }
      {
        const response = await service.search(request)
        expect(response.hitsCount).toEqual(0)
        const hitsCount = await service.sanctionsHitsRepository.countHits({
          filterSearchId: [response.searchId],
        })
        expect(hitsCount).toEqual(0)
      }
    })

    test('Filter out whitelist entities (user level)', async () => {
      const TEST_TENANT_ID = getTestTenantId()
      const service = new SanctionsService(TEST_TENANT_ID)
      const testUserId = 'test-user-id'
      const testUserId2 = 'test-user-id-2'
      const request: SanctionsSearchRequest = {
        searchTerm: 'test',
        fuzziness: 0.5,
        countryCodes: ['DE', 'FR'],
        yearOfBirth: 1992,
        types: ['SANCTIONS', 'PEP'],
      }
      {
        const response = await service.search(request, {
          ruleInstanceId: 'test',
          userId: testUserId,
        })
        expect(response.hitsCount).toEqual(totalMockHitsCount)
        const hitsCount = await service.sanctionsHitsRepository.countHits({
          filterSearchId: [response.searchId],
        })
        expect(hitsCount).toEqual(totalMockHitsCount)
      }
      for (const entityList of MOCK_SEARCH_1794517025_DATA.entities) {
        await service.addWhitelistEntities(
          entityList.content.map(
            (v) => convertEntityToHit(v).doc
          ) as any as ComplyAdvantageSearchHitDoc[],
          testUserId
        )
      }
      {
        const response = await service.search(request, {
          ruleInstanceId: 'test',
          userId: testUserId,
        })
        expect(response.hitsCount).toEqual(0)
        const hitsCount = await service.sanctionsHitsRepository.countHits({
          filterSearchId: [response.searchId],
        })
        expect(hitsCount).toEqual(0)
      }
      {
        const response = await service.search(request, {
          ruleInstanceId: 'test',
          userId: testUserId2,
        })
        expect(response.hitsCount).toEqual(totalMockHitsCount)
        const hitsCount = await service.sanctionsHitsRepository.countHits({
          filterSearchId: [response.searchId],
        })
        expect(hitsCount).toEqual(totalMockHitsCount)
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
