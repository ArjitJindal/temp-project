import { SanctionsService } from '..'
import { SanctionsSearchRepository } from '../repositories/sanctions-search-repository'
import { MOCK_CA_SEARCH_RESPONSE } from '../../../test-utils/resources/mock-ca-search-response'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'
import { mockComplyAdvantageSearch } from '@/test-utils/complyadvantage-test-utils'

jest.mock('node-fetch')
const mockFetch = mockComplyAdvantageSearch()

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
        searchTerm: 'test',
        fuzziness: 0.5,
        countryCodes: ['DE', 'FR'],
        yearOfBirth: 1992,
        types: ['SANCTIONS', 'PEP'],
        monitoring: { enabled: true },
      }
      const response = await service.search(request)
      testSearchId = response.searchId
      expect(response).toMatchObject({
        total: 1,
        data: MOCK_CA_SEARCH_RESPONSE.content?.data?.hits,
        searchId: expect.any(String),
        rawComplyAdvantageResponse: MOCK_CA_SEARCH_RESPONSE,
      })
      expect(mockFetch).toBeCalledTimes(2)
      expect(mockFetch.mock.calls[0]).toEqual([
        `https://api.complyadvantage.com/searches?api_key=fake`,
        {
          body: JSON.stringify({
            search_term: 'test',
            fuzziness: 0.5,
            filters: { country_codes: ['DE', 'FR'], birth_year: 1992 },
          }),
          method: 'POST',
        },
      ])
      expect(mockFetch.mock.calls[1]).toEqual([
        `https://api.complyadvantage.com/searches/1051192082/monitors?api_key=fake`,
        {
          body: JSON.stringify({
            is_monitored: true,
          }),
          method: 'PATCH',
        },
      ])
      expect(await service.getSearchHistory(response.searchId)).toEqual({
        _id: response.searchId,
        createdAt: expect.any(Number),
        request,
        response: response,
      })
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
        `https://api.complyadvantage.com/searches/1051192082/monitors?api_key=fake`,
        {
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
    test('Get a single search history', async () => {
      const service = new SanctionsService(TEST_TENANT_ID)
      const result = await service.getSearchHistories({})
      expect(mockFetch).toBeCalledTimes(0)
      expect(result.total).toBe(1)
      expect(result.items).toHaveLength(1)
    })
  })
})
