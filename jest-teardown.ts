import {
  getTestDynamoDb,
  TEST_DYNAMODB_TABLE_NAME_PREFIX,
} from './src/test-utils/dynamodb-test-utils'

module.exports = async function () {
  const db = getTestDynamoDb()
  const output = await db.listTables().promise()
  const tablesToDelete = (output.TableNames || []).filter((table) =>
    table.startsWith(TEST_DYNAMODB_TABLE_NAME_PREFIX)
  )
  await Promise.all(
    tablesToDelete.map((tableToDelete) =>
      db.deleteTable({ TableName: tableToDelete }).promise()
    )
  )
}
