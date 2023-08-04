import { MOCK_IBAN_COM_VALIDATION_RESPONSE } from './resources/mock-iban-com-validation-response'
import * as apiFetchModule from '@/utils/api-fetch'

export function mockIbanComValidation() {
  process.env.IBAN_API_KEY = 'fake'
  const mockFetch = jest.spyOn(apiFetchModule, 'apiFetch')

  mockFetch.mockResolvedValue({
    result: MOCK_IBAN_COM_VALIDATION_RESPONSE,
    statusCode: 200,
  })

  return mockFetch
}
