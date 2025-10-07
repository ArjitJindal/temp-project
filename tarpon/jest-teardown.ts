// NOTE: This is needed to get around https://github.com/facebook/jest/issues/11644
import 'tsconfig-paths/register'

import { execSync } from 'child_process'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MONGO_TEST_DB_PREFIX } from '@/test-utils/mongo-test-utils'
import { executeClickhouseDefaultClientQuery } from '@/utils/clickhouse/execute'

module.exports = async function () {
  if (process.env.EXEC_SOURCE !== 'CI') {
    // DynamoDB clean-up
    try {
      execSync('docker stop local-dynamodb-test')
    } catch (e) {
      // ignore
    }
    try {
      execSync('docker rm local-dynamodb-test')
    } catch (e) {
      // ignore
    }

    // MongoDB clean-up
    const mongodbClient = await getMongoDbClient()
    const databases = (
      await mongodbClient.db().admin().listDatabases()
    ).databases.filter((database) =>
      database.name.startsWith(MONGO_TEST_DB_PREFIX)
    )
    for (const database of databases) {
      await mongodbClient.db(database.name).dropDatabase()
    }

    // Clickhouse clean-up
    await executeClickhouseDefaultClientQuery(async (client) => {
      const queryResponse = await client.query({
        query: 'SHOW DATABASES',
        format: 'JSONEachRow',
      })
      const clickhouseDatabases = await queryResponse.json<{ name: string }>()

      for (const database of clickhouseDatabases) {
        if (database.name.startsWith('tarpon_test')) {
          await client.query({ query: `DROP DATABASE ${database.name}` })
        }
      }
    })
  }
}
