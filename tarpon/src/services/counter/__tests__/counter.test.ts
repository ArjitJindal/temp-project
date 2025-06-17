import { COUNTER_ENTITIES, CounterRepository } from '../repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'

dynamoDbSetupHook()

withFeaturesToggled([], ['CLICKHOUSE_ENABLED', 'CLICKHOUSE_MIGRATION'], () => {
  describe('CounterRepository', () => {
    it('should initialize counters', async () => {
      const tenantId = getTestTenantId()
      const mongoDb = await getMongoDbClient()
      const counterRepository = new CounterRepository(tenantId, mongoDb)
      await counterRepository.initialize()

      for (const entity of COUNTER_ENTITIES) {
        const counter = await counterRepository.getNextCounterAndUpdate(entity)
        expect(counter).toBeDefined()
        expect(counter).toBe(1)
      }
    })
    it('should set counter value', async () => {
      const tenantId = getTestTenantId()
      const mongoDb = await getMongoDbClient()
      const counterRepository = new CounterRepository(tenantId, mongoDb)
      await counterRepository.initialize()

      await counterRepository.setCounterValue('Alert', 1)
      const counter = await counterRepository.getNextCounter('Alert')
      expect(counter).toBe(2)
    })
    it('should get next counter and update', async () => {
      const tenantId = getTestTenantId()
      const mongoDb = await getMongoDbClient()
      const counterRepository = new CounterRepository(tenantId, mongoDb)
      await counterRepository.initialize()
      const counter = await counterRepository.getNextCounterAndUpdate('Alert')
      expect(counter).toBeDefined()
      expect(counter).toBe(1)
    })
    it('should get next counters and update', async () => {
      const tenantId = getTestTenantId()
      const mongoDb = await getMongoDbClient()
      const counterRepository = new CounterRepository(tenantId, mongoDb)
      await counterRepository.initialize()
      const counters = await counterRepository.getNextCountersAndUpdate(
        'Alert',
        3
      )
      expect(counters).toEqual([3, 2, 1])
    })
  })
})
