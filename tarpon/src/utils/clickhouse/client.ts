import { ClickHouseClient, createClient } from '@clickhouse/client'
import { NodeClickHouseClientConfigOptions } from '@clickhouse/client/dist/config'
import { ConnectionCredentials } from 'thunder-schema'
import { envIs } from '../env'
import { getSecret } from '../secrets-manager'
import { getClickhouseDbName } from './database-utils'

const useNormalLink = () => {
  if (envIs('local', 'test', 'dev') || process.env.MIGRATION_TYPE) {
    return true
  }
  return false
}

const getUrl = (config: NodeClickHouseClientConfigOptions) => {
  if (useNormalLink()) {
    return config.url?.toString().replace('vpce.', '')
  }
  return config.url
}

export const getLocalConfig = (
  database: string,
  options?: {
    keepAlive?: boolean
    idleSocketTtl?: number
    requestTimeout?: number
  }
): NodeClickHouseClientConfigOptions => ({
  url: 'http://localhost:8123',
  username: 'default',
  password: '',
  database,
  request_timeout: options?.requestTimeout ?? 300_000, // 5 minutes
  clickhouse_settings: {
    max_execution_time: 300, // 5 minutes in seconds
    send_timeout: 300,
    receive_timeout: 300,
  },
  keep_alive: {
    enabled: options?.keepAlive ?? true,
    idle_socket_ttl: options?.idleSocketTtl ?? 2_500,
  },
})

type ClickHouseSyncOptions = {
  /** Wait for actions to manipulate the partitions.
   * 0 - do not wait,
   * 1 - wait for execution only of itself,
   * 2 - wait for everyone. */
  alter_sync?: string
  /** Wait for synchronous execution of ALTER TABLE UPDATE/DELETE queries (mutations).
   * 0 - execute asynchronously.
   * 1 - wait current server.
   * 2 - wait all replicas if they exist. */
  mutations_sync?: string
}

export const getClickhouseClientConfig = async (
  database: string,
  options?: {
    keepAlive?: boolean
    idleSocketTtl?: number
    requestTimeout?: number
  } & ClickHouseSyncOptions
): Promise<NodeClickHouseClientConfigOptions> => {
  if (envIs('local') || envIs('test')) {
    return getLocalConfig(database, options)
  }

  const config = await getSecret<NodeClickHouseClientConfigOptions>(
    'clickhouse'
  )

  return {
    ...config,
    database,
    url: getUrl(config),
    // Add timeout configurations
    request_timeout: options?.requestTimeout ?? 30_000, // 30 seconds
    clickhouse_settings: {
      ...config.clickhouse_settings,
      alter_sync: options?.alter_sync ?? '2',
      mutations_sync: options?.mutations_sync ?? '2',
      // Add query-level timeout settings
      max_execution_time: 300, // 5 minutes in seconds
      send_timeout: 300, // 5 minutes
      receive_timeout: 300, // 5 minutes
    },
    keep_alive: {
      enabled: options?.keepAlive ?? true,
      idle_socket_ttl: options?.idleSocketTtl ?? 2_500,
    },
  }
}
let client: Record<string, ClickHouseClient> = {}

export async function getClickhouseClient(
  tenantId: string,
  options?: {
    requestTimeout?: number
    keepAlive?: boolean
  } & ClickHouseSyncOptions
) {
  if (client[tenantId]) {
    return client[tenantId]
  }

  if (envIs('test')) {
    const { handleClickhouseDbCreation } = await import(
      '@/core/local-handlers/clickhouse-db-creation'
    )
    await handleClickhouseDbCreation(tenantId)
  }

  const config = await getClickhouseClientConfig(
    getClickhouseDbName(tenantId),
    options
  )

  client = { [tenantId]: createClient(config) }
  return client[tenantId]
}

const getConnectionCredentials = (
  config: NodeClickHouseClientConfigOptions,
  database: string
): ConnectionCredentials => ({
  url: config.url?.toString() ?? '',
  username: config.username,
  password: config.password,
  database,
})

export async function getClickhouseCredentials(
  tenantId: string
): Promise<ConnectionCredentials> {
  const dbName = getClickhouseDbName(tenantId)
  const config = await getClickhouseClientConfig(dbName)

  if (!config.url) {
    throw new Error('Clickhouse URL is not set')
  }

  return getConnectionCredentials(config, dbName)
}

export async function getClickhouseDefaultCredentials(): Promise<ConnectionCredentials> {
  const config = await getClickhouseClientConfig('default')
  return getConnectionCredentials(config, 'default')
}

export async function getDefualtConfig(): Promise<ConnectionCredentials> {
  const config = await getClickhouseClientConfig('default')
  return getConnectionCredentials(config, 'default')
}
export const createAndExecuteWithClient = async <T>(
  config: NodeClickHouseClientConfigOptions,
  callback: (client: ClickHouseClient) => Promise<T>
): Promise<T> => {
  const clickHouseClient = createClient(config)
  const result = await callback(clickHouseClient)
  await clickHouseClient.close()
  return result
}
