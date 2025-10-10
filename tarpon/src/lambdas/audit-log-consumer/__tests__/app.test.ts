import { SQSEvent, SQSRecord } from 'aws-lambda'
import { auditLogConsumerHandler as handler } from '../app'
import { AuditLogRepository } from '@/services/audit-log/repositories/auditlog-repository'
import { AuditLogRecord } from '@/@types/audit-log'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

const auditLogConsumerHandler = handler as any as (event: SQSEvent) => void

describe('Audit Log Consumer', () => {
  test('saves new audit log', async () => {
    const TEST_TENANT_ID = getTestTenantId()
    const TEST_AUDITLOG_ID = 'test_audit_log_id'
    const timestamp = new Date().valueOf()
    const auditLog: AuditLogRecord = {
      tenantId: TEST_TENANT_ID,
      payload: {
        auditlogId: TEST_AUDITLOG_ID,
        timestamp,
        type: 'USER',
        action: 'VIEW',
      },
    }
    await auditLogConsumerHandler({
      Records: [
        {
          body: JSON.stringify({ Message: JSON.stringify(auditLog) }),
        } as SQSRecord,
      ],
    })
    const auditLogRepository = new AuditLogRepository(TEST_TENANT_ID, {
      mongoDb: await getMongoDbClient(),
      dynamoDb: getDynamoDbClient(),
    })
    const savedAuditLog = await auditLogRepository.getAuditLog(TEST_AUDITLOG_ID)
    expect(savedAuditLog).toEqual(auditLog.payload)
  })
})
