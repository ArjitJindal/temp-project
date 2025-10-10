import { execSync } from 'child_process'
import fs from 'fs'
import { ConnectionManager } from 'thunder-schema'
import { loadConfigEnv } from './migrations/utils/config'
import { logger } from '@/core/logger'
import { isClickhouseEnabledInRegion } from '@/utils/clickhouse/checks'
import { MigrationTrackerTable } from '@/models/migration-tracker'
import {
  getClickhouseDefaultCredentials,
  getDefualtConfig,
} from '@/utils/clickhouse/client'

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
  const credentials = await getClickhouseDefaultCredentials()
  const timestamp = Date.now()
  execSync(`npx thunder-schema migrate --migrations-path scripts/models`, {
    env: {
      ...process.env,
      CLICKHOUSE_URL: credentials.url,
      CLICKHOUSE_USERNAME: credentials.username,
      CLICKHOUSE_PASSWORD: credentials.password,
      CLICKHOUSE_DATABASE: credentials.database,
    },
    stdio: 'inherit',
  })
  console.log(`Migration completed for default in ${Date.now() - timestamp}ms`)

  // add all files in src/models to the migrations
  const files = fs.readdirSync('src/models/migrations')
  const allMigrations = await new MigrationTrackerTable().objects.all()
  const allFileNames = files.map((file) => file.split('.')[0])
  const migrationsToAdd = allFileNames.filter(
    (fileName) => !allMigrations.some((m) => m.id === fileName)
  )

  for (const fileName of migrationsToAdd) {
    const fileData = require(`../src/models/migrations/${fileName}.ts`) // eslint-disable-line @typescript-eslint/no-var-requires
    const diff = fileData.diff
    const migration = new MigrationTrackerTable().create({
      id: fileName,
      createdAt: Number(fileName.split('-')[0]),
      data: JSON.stringify(diff),
    })
    await migration.save()
  }
}

if (require.main === module) {
  void migrateClickhouse()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}
