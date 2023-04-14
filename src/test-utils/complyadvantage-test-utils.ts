import fetch, { Response } from 'node-fetch'
import _ from 'lodash'
import { MOCK_CA_SEARCH_RESPONSE } from './resources/mock-ca-search-response'

export function mockComplyAdvantageSearch(hit = true) {
  process.env.COMPLYADVANTAGE_API_KEY = 'fake'
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>
  const response = _.cloneDeep(MOCK_CA_SEARCH_RESPONSE)
  if (!hit) {
    response.content.data.hits = []
  }
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve(response),
  } as Response)
  return mockFetch
}
