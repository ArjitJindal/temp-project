import { URLSearchParams } from 'url'
import _ from 'lodash'
import { Response } from 'node-fetch'
import { IBANService } from '..'
import { IBANApiRepository } from '../repositories/iban-api-repository'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { mockIbanComValidation } from '@/test-utils/ibancom-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { MOCK_IBAN_COM_VALIDATION_RESPONSE } from '@/test-utils/resources/mock-iban-com-validation-response'

dynamoDbSetupHook()
withFeatureHook(['IBAN_RESOLUTION'])

jest.mock('node-fetch')
const mockFetch = mockIbanComValidation()

const TEST_VALID_IBAN = 'DE75512108001245126199'
const EXPECTED_RESPONSE = {
  BIC: 'BUKBGB22XXX',
  IBAN: 'DE75512108001245126199',
  bankAddress: {
    addressLines: [''],
    city: 'Leicester',
    country: 'United Kingdom',
    postcode: 'LE87 2BB',
    state: '',
  },
  bankBranchCode: '202015',
  bankName: 'BARCLAYS BANK UK PLC',
  method: 'IBAN',
}

beforeEach(() => {
  mockFetch.mockClear()
})

describe('IBAN Validation', () => {
  test('Requests iban.com and persists the result', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID)
    const response = await service.validateIBAN(TEST_VALID_IBAN)
    expect(response).toEqual(EXPECTED_RESPONSE)
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
    await service.validateIBAN('DE75512108001245126199')
    await service.validateIBAN(' DE75512108001245126199 ')
    await service.validateIBAN('DE75 5121 0800 1245 1261 99')
    await service.validateIBAN(' DE75 5121 0800 1245 1261 99 ')
    expect(mockFetch).toBeCalledTimes(1)
  })

  test('Requesting invalid iban should not call the API', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID)
    await service.validateIBAN('not a valid iban')
    await service.validateIBAN('75512108001245126199')
    await service.validateIBAN('GG75512108001245126199')
    expect(mockFetch).toBeCalledTimes(0)
  })

  test('throws error if we have account errors', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const service = new IBANService(TEST_TENANT_ID)
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          ...MOCK_IBAN_COM_VALIDATION_RESPONSE,
          errors: [{ code: '303', message: 'No queries available' }],
        }),
    } as Response)
    await expect(service.validateIBAN(TEST_VALID_IBAN)).rejects.toThrow()
  })
})
