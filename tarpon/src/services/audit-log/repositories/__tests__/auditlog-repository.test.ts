import { v4 as uuidv4 } from 'uuid'
import { getAuditLogRepo } from './helpers'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

dynamoDbSetupHook()

const createTestAuditLog = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  auditlogId: uuidv4(),
  timestamp: Date.now(),
  action: 'CREATE',
  entityId: uuidv4(),
  user: {
    id: 'user-123',
    role: 'admin',
    email: 'john.doe@example.com',
    emailVerified: true,
    name: 'John Doe',
    blocked: false,
    orgName: 'flagright',
    tenantId: 'flagright',
  },
  type: 'ALERT',
  subtype: 'ALERT_LIST',
  ...overrides,
})

withFeaturesToggled([], ['CLICKHOUSE_MIGRATION', 'CLICKHOUSE_ENABLED'], () => {
  describe('AuditLogRepository', () => {
    let auditLogRepository
    let tenantId: string

    beforeEach(async () => {
      tenantId = getTestTenantId()
      auditLogRepository = await getAuditLogRepo(tenantId)
    })

    it('should save and retrieve an audit log by its ID', async () => {
      const testLog = createTestAuditLog()
      await auditLogRepository.saveAuditLog(testLog)

      const retrievedLog = await auditLogRepository.getAuditLog(
        testLog.auditlogId as string
      )

      expect(retrievedLog).toBeDefined()
      expect(retrievedLog).toEqual(
        expect.objectContaining({
          auditlogId: testLog.auditlogId,
          entityId: testLog.entityId,
          action: testLog.action,
        })
      )
    })

    it('should correctly count all audit logs', async () => {
      await auditLogRepository.saveAuditLog(createTestAuditLog())
      await auditLogRepository.saveAuditLog(createTestAuditLog())

      const count = await auditLogRepository.getAuditLogCount({})

      expect(count).toBe(2)
    })

    it('should retrieve all audit logs with correct pagination data', async () => {
      const testLog = createTestAuditLog()
      await auditLogRepository.saveAuditLog(testLog)

      const result = await auditLogRepository.getAllAuditLogs({})

      expect(result.total).toBe(1)
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          auditlogId: testLog.auditlogId,
          entityId: testLog.entityId,
          action: testLog.action,
        })
      )
    })

    it('should correctly count audit logs based on a filter', async () => {
      await auditLogRepository.saveAuditLog(
        createTestAuditLog({ action: 'CREATE' })
      )
      await auditLogRepository.saveAuditLog(
        createTestAuditLog({ action: 'UPDATE' })
      )
      await auditLogRepository.saveAuditLog(
        createTestAuditLog({ action: 'UPDATE' })
      )

      const count = await auditLogRepository.getAuditLogCount({
        filterActions: ['UPDATE'],
      })

      expect(count).toBe(2)
    })

    it('should retrieve audit logs that match the specified filter', async () => {
      const createLog = createTestAuditLog({ action: 'CREATE' })
      const updateLog = createTestAuditLog({ action: 'UPDATE' })
      await auditLogRepository.saveAuditLog(createLog)
      await auditLogRepository.saveAuditLog(updateLog)

      const result = await auditLogRepository.getAllAuditLogs({
        filterActions: ['UPDATE'],
      })

      expect(result.total).toBe(1)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].action).toBe('UPDATE')
      expect(result.data[0].auditlogId).toBe(updateLog.auditlogId)
    })

    it('should return an empty array when no logs match the filter', async () => {
      await auditLogRepository.saveAuditLog(
        createTestAuditLog({ action: 'CREATE' })
      )

      const result = await auditLogRepository.getAllAuditLogs({
        filterActions: ['DELETE'],
      })

      expect(result.total).toBe(0)
      expect(result.data).toHaveLength(0)
    })

    it('should confirm that an audit log was saved successfully', async () => {
      const testLog = createTestAuditLog()
      const savedLog = await auditLogRepository.saveAuditLog(testLog)

      expect(savedLog).toBeDefined()
      expect(savedLog.auditlogId).toBe(testLog.auditlogId)
    })
  })
})
