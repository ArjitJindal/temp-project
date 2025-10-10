import { AuditLogRepository } from '../auditlog-repository'
import { prepareClickhouseInsert } from '@/utils/clickhouse/insert'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'

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
