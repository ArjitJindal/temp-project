import { ALERT_TIMESTAMP } from '../alert-timestamp'
import { getTestUser } from '@/test-utils/user-test-utils'
import { AlertsRepository } from '@/services/alerts/repository'

// Mock the dependencies
jest.mock('@/services/alerts/repository')

const mockAlertsRepository = AlertsRepository as jest.MockedClass<
  typeof AlertsRepository
>

test('Alert timestamp when alert exists', async () => {
  const user = getTestUser({ userId: 'test-user-id' })
  const context = {
    tenantId: 'test-tenant',
    dynamoDb: {} as any,
  }

  const mockRepository = {
    getLatestAlertTimestampForUser: jest.fn().mockResolvedValue(1640995200000), // 2022-01-01
  }

  mockAlertsRepository.mockImplementation(() => mockRepository as any)

  const result = await ALERT_TIMESTAMP.load(user, context)
  expect(result).toBe(1640995200000)
})

test('Alert timestamp when no alerts exist', async () => {
  const user = getTestUser({ userId: 'test-user-id' })
  const context = {
    tenantId: 'test-tenant',
    dynamoDb: {} as any,
  }

  const mockRepository = {
    getLatestAlertTimestampForUser: jest.fn().mockResolvedValue(null),
  }

  mockAlertsRepository.mockImplementation(() => mockRepository as any)

  const result = await ALERT_TIMESTAMP.load(user, context)
  expect(result).toBeUndefined()
})

test('Alert timestamp returns undefined without context', async () => {
  const user = getTestUser({ userId: 'test-user-id' })
  const result = await ALERT_TIMESTAMP.load(user)
  expect(result).toBeUndefined()
})
