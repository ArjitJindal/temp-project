import { execSync } from 'child_process'

module.exports = async function () {
  const TEST_DYNAMODB_TABLE_NAME =
    process.env.TEST_DYNAMODB_TABLE_NAME || 'test'
  execSync(`npm run delete-local-ddb --table=${TEST_DYNAMODB_TABLE_NAME}`)
}
