import { exec, execSync } from 'child_process'
import { TEST_DYNAMODB_TABLE_NAMES } from './src/test-utils/dynamodb-test-utils'

process.env.ENV = 'local'
process.env.DYNAMODB_URI = 'http://localhost:7999'

jest.mock('@cdk/constants', () => ({
  StackConstants: {
    TARPON_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[0],
    TARPON_RULE_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[1],
    HAMMERHEAD_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[2],
    TRANSIENT_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[3],
  },
}))

module.exports = async function () {
  if (process.env.EXEC_SOURCE !== 'CI') {
    const localDynamoDbTestPsOutput = execSync(
      'docker ps -f name=local-dynamodb-test',
      {
        encoding: 'utf8',
        stdio: [],
      }
    )
    if (!localDynamoDbTestPsOutput.includes('local-dynamodb-test')) {
      try {
        execSync('docker rm local-dynamodb-test', { stdio: [] })
      } catch (e) {
        //ignore
      }
      exec(
        'docker run --name local-dynamodb-test -p 7999:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb'
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}
