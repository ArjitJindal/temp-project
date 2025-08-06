import path from 'path'
import { readdirSync } from 'fs'
import { JsonMigrationService } from 'thunder-schema'
import {
  getClickhouseClient,
  getClickhouseCredentials,
  getClickhouseDbName,
} from '../utils/clickhouse/utils'

export const setupClickHouseForTest = async (
  tenantId: string,
  tableNames: string[]
) => {
  const client = await getClickhouseCredentials(tenantId)
  const clickhouseClient = await getClickhouseClient(tenantId)
  await clickhouseClient.exec({
    query: `CREATE DATABASE IF NOT EXISTS ${getClickhouseDbName(tenantId)}`,
  })

  // all files in the models folder
  const files = readdirSync(path.join(__dirname, '..', 'models', 'migrations'))
  // sort files by name ascending split by - and take the first part convert to number
  files.sort((a, b) => {
    const aNumber = parseInt(a.split('-')[0])
    const bNumber = parseInt(b.split('-')[0])
    return aNumber - bNumber
  })
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const migration = require(path.join(
      __dirname,
      '..',
      'models',
      'migrations',
      file
    ))

    const diff = migration.diff.filter((d) => {
      const diffTableName = d.changes?.tableName || d.changes?.schema?.tableName
      return tableNames.includes(diffTableName)
    })

    const jsonMigrationService = new JsonMigrationService(client)
    await jsonMigrationService.migrate(`${file}.ts`, diff)
  }
  for (const tableName of tableNames) {
    await clickhouseClient.exec({
      query: `DELETE FROM ${tableName} WHERE 1=1`,
    })
  }
}

export const cleanupClickHouseForTest = async (tenantId: string) => {
  const clickhouseClient = await getClickhouseClient(tenantId)
  await clickhouseClient.exec({
    query: `DROP DATABASE IF EXISTS ${getClickhouseDbName(tenantId)}`,
  })
}

export const thunderSchemaSetupHook = (
  tenantId: string,
  tableNames: string[]
) => {
  beforeAll(async () => {
    await setupClickHouseForTest(tenantId, tableNames)
  })

  afterAll(async () => {
    await cleanupClickHouseForTest(tenantId)
  })
}
