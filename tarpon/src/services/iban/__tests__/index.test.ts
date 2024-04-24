import { IBANService } from '..'
import { IBANApiRepository } from '../repositories/iban-api-repository'
import { ApiProvider } from '../providers/types'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

dynamoDbSetupHook()
withFeatureHook(['IBAN_RESOLUTION'])

const TEST_VALID_IBAN = 'DE75512108001245126199'
const EXPECTED_RESPONSE = {
  iban: 'DE75512108001245126199',
  bankName: 'mock bank name',
}
const MOCK_API_RESPONSE = {
  response: { bankName: 'mock bank name' },
  rawResponse: { raw: { name: 'mock bank name' } },
}
class MockApiProvider implements ApiProvider {
  source = ''
  enabled() {
    return true
  }
  cacheable() {
    return true
  }
  async resolveIban(_iban: string) {
    return MOCK_API_RESPONSE
  }
}
const MOCK_API_PROVIDER = new MockApiProvider()

const mockResolveIban = jest.spyOn(MOCK_API_PROVIDER, 'resolveIban')

beforeEach(() => {
  mockResolveIban.mockClear()
})

describe('IBAN Validation', () => {
  test('Requests API providers and persists the result', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID, [MOCK_API_PROVIDER])
    const response = await service.resolveBankNames([{ iban: TEST_VALID_IBAN }])
    expect(response).toBeTruthy()
    if (response) {
      expect(response[0]).toEqual(EXPECTED_RESPONSE)
    }
    const ibanApiRepository = new IBANApiRepository(
      TEST_TENANT_ID,
      await getMongoDbClient()
    )
    const history = await ibanApiRepository.getLatestIbanValidationHistory(
      TEST_VALID_IBAN
    )
    expect(history?.request.iban).toBe(TEST_VALID_IBAN)
    expect(history?.response).toEqual(MOCK_API_RESPONSE.response)
    expect(history?.rawResponse).toEqual(MOCK_API_RESPONSE.rawResponse)
  })

  test('Requesting same iban multiple times should only call the API once', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID, [MOCK_API_PROVIDER])
    await service.resolveBankNames([
      { iban: 'DE75512108001245126199' },
      { iban: 'AT483200000012345864' },
    ])
    await service.resolveBankNames([
      { iban: '  DE75512108001245126199  ' },
      { iban: '  AT483200000012345864' },
    ])
    await service.resolveBankNames([
      { iban: 'DE75 5121 0800 1245 1261 99' },
      { iban: 'AT483200000012345864  ' },
    ])
    await service.resolveBankNames([
      { iban: ' DE75 5121 0800 1245 1261 99 ' },
      { iban: 'AT48 3200 0000 1234 5864' },
    ])
    expect(mockResolveIban).toBeCalledTimes(2)
  })

  test('Requesting invalid iban should not call the API', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID, [MOCK_API_PROVIDER])
    await service.resolveBankNames([{ iban: 'not a valid iban' }])
    await service.resolveBankNames([{ iban: '75512108001245126199' }])
    await service.resolveBankNames([{ iban: 'GG75512108001245126199' }])
    expect(mockResolveIban).toBeCalledTimes(0)
  })
})
