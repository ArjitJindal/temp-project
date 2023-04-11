import fetch, { Response } from 'node-fetch'
import { MOCK_IBAN_COM_VALIDATION_RESPONSE } from './resources/mock-iban-com-validation-response'

export function mockIbanComValidation() {
  process.env.IBAN_API_KEY = 'fake'
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve(MOCK_IBAN_COM_VALIDATION_RESPONSE),
  } as Response)
  return mockFetch
}
