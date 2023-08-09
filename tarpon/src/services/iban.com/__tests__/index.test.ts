import { URLSearchParams } from 'url'
import _ from 'lodash'
import { IBANService } from '..'
import { IBANApiRepository } from '../repositories/iban-api-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { mockIbanComValidation } from '@/test-utils/ibancom-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { MOCK_IBAN_COM_VALIDATION_RESPONSE } from '@/test-utils/resources/mock-iban-com-validation-response'
import * as apiFetchModule from '@/utils/api-fetch'

dynamoDbSetupHook()
withFeatureHook(['IBAN_RESOLUTION'])

const TEST_VALID_IBAN = 'DE75512108001245126199'
const EXPECTED_RESPONSE = {
  iban: 'DE75512108001245126199',
  bankName: 'BARCLAYS BANK UK PLC',
}

const mockFetch = mockIbanComValidation()

beforeEach(() => {
  mockFetch.mockClear()
})

describe('IBAN Validation', () => {
  test('Requests iban.com and persists the result', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID)
    const response = await service.resolveBankNames([{ iban: TEST_VALID_IBAN }])
    expect(response).toBeTruthy()
    if (response) {
      expect(response[0]).toEqual(EXPECTED_RESPONSE)
    }
    expect(mockFetch).toBeCalledTimes(1)
    expect(mockFetch).toBeCalledWith(
      'https://api.iban.com/clients/api/v4/iban/',
      {
        body: new URLSearchParams({
          api_key: 'fake',
          format: 'json',
          iban: 'DE75512108001245126199',
        }),
        headers: { 'User-Agent': 'IBAN API Client/0.0.1' },
        method: 'POST',
      }
    )

    const ibanApiRepository = new IBANApiRepository(
      TEST_TENANT_ID,
      await getMongoDbClient()
    )
    const history = await ibanApiRepository.getLatestIbanValidationHistory(
      TEST_VALID_IBAN
    )
    expect(history?.request.iban).toBe(TEST_VALID_IBAN)
    expect(_.isEmpty(history?.response)).toBe(false)
  })

  test('Requesting same iban multiple times should only call the API once', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID)
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
    expect(mockFetch).toBeCalledTimes(2)
  })

  test('Requesting invalid iban should not call the API', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID)
    await service.resolveBankNames([{ iban: 'not a valid iban' }])
    await service.resolveBankNames([{ iban: '75512108001245126199' }])
    await service.resolveBankNames([{ iban: 'GG75512108001245126199' }])
    expect(mockFetch).toBeCalledTimes(0)
  })

  test('throws error if we have account errors', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID)
    const mockFetch = jest.spyOn(apiFetchModule, 'apiFetch')

    mockFetch.mockResolvedValue({
      result: {
        ...MOCK_IBAN_COM_VALIDATION_RESPONSE,
        errors: [{ code: '303', message: 'No queries available' }],
      },
      statusCode: 303,
    })
    await expect(
      service.resolveBankNames([{ iban: TEST_VALID_IBAN }])
    ).rejects.toThrow()
  })
})
