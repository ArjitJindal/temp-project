import { envIs } from '@/utils/env'
import { executeClickhouseDefaultClientQuery } from '@/utils/clickhouse/execute'
import { getClickhouseDbName } from '@/utils/clickhouse/database-utils'

export const handleClickhouseDbCreation = async (
  tenantId: string
): Promise<void> => {
  if (envIs('test')) {
    await executeClickhouseDefaultClientQuery(async (clickHouseClient) => {
      await clickHouseClient.query({
        query: `CREATE DATABASE IF NOT EXISTS ${getClickhouseDbName(tenantId)}`,
      })
    })
  }
}
