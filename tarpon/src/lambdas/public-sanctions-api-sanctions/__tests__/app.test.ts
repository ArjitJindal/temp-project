import { sanctionsHandler } from '../app'
import {
  getApiGatewayGetEvent,
  getApiGatewayPatchEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { mockComplyAdvantageSearch } from '@/test-utils/complyadvantage-test-utils'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { MOCK_CA_SEARCH_RESPONSE } from '@/test-utils/resources/mock-ca-search-response'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { SanctionsSearchRequest } from '@/@types/openapi-internal/SanctionsSearchRequest'

jest.mock('node-fetch')
const mockFetch = mockComplyAdvantageSearch()
dynamoDbSetupHook()

describe('Public Sanctions API', () => {
  const TEST_TENANT_ID = getTestTenantId()
  const TEST_REQUEST: SanctionsSearchRequest = {
    searchTerm: 'ABC bank',
    countryCodes: ['DE'],
    monitoring: { enabled: true },
    types: ['SANCTIONS', 'PEP'],
    fuzziness: 0.5,
  }
  let searchId: string

  withFeatureHook(['SANCTIONS'])

  beforeEach(() => {
    mockFetch.mockClear()
  })

  test('POST /searches', async () => {
    const response = await sanctionsHandler(
      getApiGatewayPostEvent(TEST_TENANT_ID, '/searches', TEST_REQUEST),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    const body = JSON.parse(response.body)
    searchId = body.searchId
    expect(response.statusCode).toEqual(200)
    expect(body).toEqual({
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      request: TEST_REQUEST,
      response: MOCK_CA_SEARCH_RESPONSE.content.data,
      searchId: expect.any(String),
    })
  })

  test('PATCH /searches/{searchId}', async () => {
    const response = await sanctionsHandler(
      getApiGatewayPatchEvent(
        TEST_TENANT_ID,
        '/searches/{searchId}',
        { monitoring: { enabled: true } },
        { pathParameters: { searchId } }
      ),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    expect(response.statusCode).toEqual(200)
    expect(JSON.parse(response.body)).toBe('OK')
  })

  test('GET /searches/{searchId}', async () => {
    const response = await sanctionsHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/searches/{searchId}', {
        pathParameters: { searchId },
      }),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    expect(response.statusCode).toEqual(200)
    expect(JSON.parse(response.body)).toEqual({
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
      request: TEST_REQUEST,
      response: MOCK_CA_SEARCH_RESPONSE.content.data,
      searchId,
    })
  })

  test('GET /searches/{searchId} (Non-existent search)', async () => {
    const response = await sanctionsHandler(
      getApiGatewayGetEvent(TEST_TENANT_ID, '/searches/{searchId}', {
        pathParameters: { searchId: 'foo' },
      }),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    expect(response.statusCode).toEqual(404)
  })
})

describe('Without SANCTIONS feature flag', () => {
  test('GET /searches/{searchId} - Forbidden', async () => {
    const response = await sanctionsHandler(
      getApiGatewayGetEvent(getTestTenantId(), '/searches/{searchId}', {
        pathParameters: { searchId: 'foo' },
      }),
      null as any,
      null as any
    )
    if (response == null) {
      throw new Error(`Response is empty`)
    }
    expect(response.statusCode).toEqual(403)
  })
})
