import { ApiRequestLog } from '@/@types/request-logger'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { batchInsertToClickhouse } from '@/utils/clickhouse/insert'

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
