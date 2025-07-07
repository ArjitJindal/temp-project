import { ObjectId } from 'mongodb'
import { getReasonsRepository } from './helpers'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

dynamoDbSetupHook()
const mockReasons: (ConsoleActionReason & { _id?: ObjectId })[] = [
  {
    id: 'A-001',
    _id: new ObjectId('68489a7f333ab03dc7851d80'),
    reason: 'test',
    reasonType: 'ESCALATION',
    isActive: true,
  },
  {
    id: 'A-002',
    _id: new ObjectId('68489a7f333ab03dc7851d81'),
    reason: 'test2',
    reasonType: 'CLOSURE',
    isActive: true,
  },
]
withFeaturesToggled([], ['CLICKHOUSE_MIGRATION', 'CLICKHOUSE_ENABLED'], () => {
  describe('ReasonsRepository', () => {
    it('should insert reasons', async () => {
      const tenantId = getTestTenantId()
      const repository = await getReasonsRepository(tenantId)
      await repository.bulkAddReasons(mockReasons)
    })
    it('should get reasons', async () => {
      const tenantId = getTestTenantId()
      const repository = await getReasonsRepository(tenantId)
      await repository.bulkAddReasons(mockReasons)
      const reasons = await repository.getReasons()
      expect(reasons.length).toEqual(2)
      expect(reasons[0].reason).toEqual('test')
      expect(reasons[1].reason).toEqual('test2')
      expect(reasons[0].reasonType).toEqual('ESCALATION')
      expect(reasons[1].reasonType).toEqual('CLOSURE')
    })
    it('should get reasons by type', async () => {
      const tenantId = getTestTenantId()
      const repository = await getReasonsRepository(tenantId)
      await repository.bulkAddReasons(mockReasons)
      const reasons = await repository.getReasons('ESCALATION')
      expect(reasons.length).toEqual(1)
      expect(reasons[0].reason).toEqual('test')
      expect(reasons[0].reasonType).toEqual('ESCALATION')
    })
    it('should update reasons', async () => {
      const tenantId = getTestTenantId()
      const repository = await getReasonsRepository(tenantId)
      await repository.bulkAddReasons(mockReasons)
      await repository.updateReason('A-001', 'ESCALATION', { reason: 'test3' })
      const reasons = await repository.getReasons()
      expect(reasons.length).toEqual(2)
      expect(reasons[0].reason).toEqual('test3')
      expect(reasons[1].reason).toEqual('test2')
      expect(reasons[0].reasonType).toEqual('ESCALATION')
      expect(reasons[1].reasonType).toEqual('CLOSURE')
    })
  })
})
