import { DBSQLClient } from '@databricks/sql'
import { getSecret } from '@/utils/secrets-manager'
import { getContext } from '@/core/utils/context'

// TODO create a pool of connected clients, like for DynamoDb
// https://www.notion.so/flagright/Reuse-connected-databricks-SQL-client-b33a5fd5323142a5a1cea880e5c57470
export async function executeSql<T>(
  sql: string,
  namedParameters: any = {}
): Promise<T[]> {
  const tenantId = getContext()?.tenantId?.toLowerCase()
  const credentials = await getSecret<{
    path: string
    host: string
    token: string
  }>(`databricks/tenants/${tenantId}`)

  const client = new DBSQLClient()
  const connectOptions = {
    token: credentials.token,
    host: credentials.host,
    path: credentials.path,
  }

  const connectedClient = await client.connect(connectOptions)
  const session = await connectedClient.openSession({
    initialCatalog: process.env.ENV == 'local' ? 'dev' : process.env.ENV,
    initialSchema: tenantId,
  })
  const statement = await session.executeStatement(sql, {
    namedParameters,
  })

  const result = await statement.fetchAll()
  await statement.close()
  await session.close()
  return result as T[]
}
