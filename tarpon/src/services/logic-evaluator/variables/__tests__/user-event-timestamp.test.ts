import { USER_EVENT_TIMESTAMP } from '../user-event-timestamp'
import { getTestUser } from '@/test-utils/user-test-utils'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'

// Mock the dependencies
jest.mock('@/services/rules-engine/repositories/user-event-repository')

const mockUserEventRepository = UserEventRepository as jest.MockedClass<
  typeof UserEventRepository
>

test('User event timestamp when event exists', async () => {
  const user = getTestUser({ userId: 'test-user-id' })
  const context = {
    tenantId: 'test-tenant',
    dynamoDb: {} as any,
  }

  const mockRepository = {
    getLatestUserEventTimestampForUser: jest
      .fn()
      .mockResolvedValue(1640995200000), // 2022-01-01
  }

  mockUserEventRepository.mockImplementation(() => mockRepository as any)

  const result = await USER_EVENT_TIMESTAMP.load(user, context)
  expect(result).toBe(1640995200000)
})

test('User event timestamp when no events exist', async () => {
  const user = getTestUser({ userId: 'test-user-id' })
  const context = {
    tenantId: 'test-tenant',
    dynamoDb: {} as any,
  }

  const mockRepository = {
    getLatestUserEventTimestampForUser: jest.fn().mockResolvedValue(null),
  }

  mockUserEventRepository.mockImplementation(() => mockRepository as any)

  const result = await USER_EVENT_TIMESTAMP.load(user, context)
  expect(result).toBeUndefined()
})

test('User event timestamp returns undefined without context', async () => {
  const user = getTestUser({ userId: 'test-user-id' })
  const result = await USER_EVENT_TIMESTAMP.load(user)
  expect(result).toBeUndefined()
})
