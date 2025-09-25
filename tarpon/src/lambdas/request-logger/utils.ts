import { ApiRequestLog } from '@/@types/request-logger'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { batchInsertToClickhouse } from '@/utils/clickhouse/utils'

export const handleRequestLoggerTaskClickhouse = async (
  tenantId: string,
  logs: ApiRequestLog[]
) => {
  await batchInsertToClickhouse(
    tenantId,
    CLICKHOUSE_DEFINITIONS.API_REQUEST_LOGS.tableName,
    logs
  )
}
