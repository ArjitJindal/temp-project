import fetch, { Response } from 'node-fetch'
import _ from 'lodash'
import {
  MOCK_CA_SEARCH_NO_HIT_RESPONSE,
  MOCK_CA_SEARCH_RESPONSE,
} from './resources/mock-ca-search-response'

export function mockComplyAdvantageSearch(hit = true) {
  process.env.COMPLYADVANTAGE_API_KEY = 'fake'
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>
  mockFetch.mockResolvedValue({
    json: () =>
      Promise.resolve(
        hit ? MOCK_CA_SEARCH_RESPONSE : MOCK_CA_SEARCH_NO_HIT_RESPONSE
      ),
  } as Response)
  return mockFetch
}
