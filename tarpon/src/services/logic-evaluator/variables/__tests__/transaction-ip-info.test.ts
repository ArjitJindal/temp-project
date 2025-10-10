import {
  TRANSACTION_DESTINATION_IP_CITY_VARIABLE,
  TRANSACTION_DESTINATION_IP_COUNTRY_VARIABLE,
  TRANSACTION_ORIGIN_IP_CITY_VARIABLE,
  TRANSACTION_ORIGIN_IP_COUNTRY_VARIABLE,
} from '../transaction-ip-info'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getTestTransaction } from '@/test-utils/transaction-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
const TEST_IP_LOOKUPS = {
  '101.223.255.254': { country: 'IN', city: 'Mumbai' },
  '101.46.183.254': { country: 'SG', city: 'Jurong East' },
  '1.199.255.254': { country: 'CN', city: 'Beijing' },
  '182.56.66.85': { country: 'IN', city: 'Mumbai' },
  '188.34.130.40': { country: 'DE', city: 'Frankfurt am Main' },
  '95.90.241.171': { country: 'DE', city: 'Berlin' },
}

jest.mock('@/services/geo-ip', () => ({
  GeoIPService: jest.fn().mockImplementation(() => ({
    resolveIpAddress: jest.fn((ip: string) => {
      return TEST_IP_LOOKUPS[ip]
    }),
    hydrateIpInfo: jest.fn((_transaction: any) => undefined),
  })),
}))
const TEST_TENANT_ID = getTestTenantId()

const dynamoDb = getDynamoDbClient()

test('Transaction with origin ip', async () => {
  const value = await TRANSACTION_ORIGIN_IP_COUNTRY_VARIABLE.load(
    getTestTransaction({
      originDeviceData: {
        ipAddress: '101.223.255.254',
      },
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )

  expect(value).toBe('IN')

  const value2 = await TRANSACTION_ORIGIN_IP_COUNTRY_VARIABLE.load(
    getTestTransaction({
      originDeviceData: {
        ipAddress: '101.46.183.254',
      },
    }),

    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value2).toBe('SG')

  const value3 = await TRANSACTION_ORIGIN_IP_COUNTRY_VARIABLE.load(
    getTestTransaction({
      originDeviceData: {
        ipAddress: '1.199.255.254',
      },
    }),

    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value3).toBe('CN')
})
test('Transaction with destination ip', async () => {
  const value = await TRANSACTION_DESTINATION_IP_COUNTRY_VARIABLE.load(
    getTestTransaction({
      destinationDeviceData: {
        ipAddress: '101.223.255.254',
      },
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )

  expect(value).toBe('IN')

  const value2 = await TRANSACTION_DESTINATION_IP_COUNTRY_VARIABLE.load(
    getTestTransaction({
      destinationDeviceData: {
        ipAddress: '101.46.183.254',
      },
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value2).toBe('SG')

  const value3 = await TRANSACTION_DESTINATION_IP_COUNTRY_VARIABLE.load(
    getTestTransaction({
      destinationDeviceData: {
        ipAddress: '1.199.255.254',
      },
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value3).toBe('CN')
})
test('Transaction with ip - city', async () => {
  const value = await TRANSACTION_DESTINATION_IP_CITY_VARIABLE.load(
    getTestTransaction({
      destinationDeviceData: {
        ipAddress: '182.56.66.85',
      },
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )

  expect(value).toBe('Mumbai')

  const value2 = await TRANSACTION_DESTINATION_IP_CITY_VARIABLE.load(
    getTestTransaction({
      destinationDeviceData: {
        ipAddress: '188.34.130.40',
      },
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value2).toBe('Frankfurt am Main')

  const value3 = await TRANSACTION_ORIGIN_IP_CITY_VARIABLE.load(
    getTestTransaction({
      originDeviceData: {
        ipAddress: '95.90.241.171',
      },
    }),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value3).toBe('Berlin')

  const value4 = await TRANSACTION_ORIGIN_IP_CITY_VARIABLE.load(
    getTestTransaction({}),
    { tenantId: TEST_TENANT_ID, dynamoDb }
  )
  expect(value4).toBeUndefined()
})
