import _ from 'lodash'
import {
  MOCK_CA_SEARCH_NO_HIT_RESPONSE,
  MOCK_CA_SEARCH_RESPONSE,
} from './resources/mock-ca-search-response'
import * as apiFetchModule from '@/utils/api-fetch'

export function mockComplyAdvantageSearch(hit = true) {
  process.env.COMPLYADVANTAGE_API_KEY = 'fake'
  const mockFetch = jest.spyOn(apiFetchModule, 'apiFetch')
  mockFetch.mockResolvedValue({
    result: hit ? MOCK_CA_SEARCH_RESPONSE : MOCK_CA_SEARCH_NO_HIT_RESPONSE,
    statusCode: hit ? 200 : 404,
  })
  return mockFetch
}
