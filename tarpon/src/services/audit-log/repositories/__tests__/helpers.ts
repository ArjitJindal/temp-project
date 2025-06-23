import { AuditLogRepository } from '../auditlog-repository'
import { prepareClickhouseInsert } from '@/utils/clickhouse/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

export async function getAuditLogRepo(tenantId: string) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  await prepareClickhouseInsert(
    CLICKHOUSE_DEFINITIONS.AUDIT_LOGS.tableName,
    tenantId
  )
  return new AuditLogRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
}
