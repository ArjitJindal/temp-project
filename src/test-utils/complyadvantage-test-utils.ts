import fetch, { Response } from 'node-fetch'
import { MOCK_CA_SEARCH_RESPONSE } from './resources/mock-ca-search-response'

export function mockComplyAdvantageSearch() {
  process.env.COMPLYADVANTAGE_API_KEY = 'fake'
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve(MOCK_CA_SEARCH_RESPONSE),
  } as Response)
  return mockFetch
}
