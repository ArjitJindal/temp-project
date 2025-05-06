import { execSync } from 'child_process'
import { ConnectionManager } from 'thunder-schema'
import { loadConfigEnv } from './migrations/utils/config'
import { migrateAllTenants } from './migrations/utils/tenant'
import { logger } from '@/core/logger'
import {
  getClickhouseCredentials,
  getDefualtConfig,
  isClickhouseEnabledInRegion,
} from '@/utils/clickhouse/utils'

export async function migrateClickhouse() {
  loadConfigEnv()
  if (!isClickhouseEnabledInRegion()) {
    logger.info('Clickhouse is not enabled in this region')
    return
  }
  const defaultConfig = await getDefualtConfig()
  ConnectionManager.setDefault({
    credentials: defaultConfig,
  })
  await migrateAllTenants(async (tenant) => {
    const credentials = await getClickhouseCredentials(tenant.id)
    process.env.CLICKHOUSE_URL = credentials.url
    process.env.CLICKHOUSE_USERNAME = credentials.username
    process.env.CLICKHOUSE_PASSWORD = credentials.password
    process.env.CLICKHOUSE_DATABASE = credentials.database
    const timestamp = Date.now()
    execSync(`npx thunder-schema migrate --migrations-path src/models`, {
      env: {
        ...process.env,
        CLICKHOUSE_URL: credentials.url,
        CLICKHOUSE_USERNAME: credentials.username,
        CLICKHOUSE_PASSWORD: credentials.password,
        CLICKHOUSE_DATABASE: credentials.database,
      },
      stdio: 'inherit',
    })
    console.log(
      `Migration completed for tenant ${tenant.id} in ${
        Date.now() - timestamp
      }ms`
    )
  })
}

migrateClickhouse().catch((err) => {
  logger.error(err)
  process.exit(1)
})
