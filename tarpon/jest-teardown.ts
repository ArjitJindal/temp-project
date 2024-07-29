// NOTE: This is needed to get around https://github.com/facebook/jest/issues/11644
import 'tsconfig-paths/register'

import { execSync } from 'child_process'
import axios from 'axios'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { MONGO_TEST_DB_PREFIX } from '@/test-utils/mongo-test-utils'

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
    await axios.post(
      'http://localhost:8123/?query=DROP%20DATABASE%20IF%20EXISTS%20tarpon_test'
    )
  }
}
