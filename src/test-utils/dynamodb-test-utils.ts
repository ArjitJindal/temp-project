import { execSync } from 'child_process'
import { exit } from 'process'
import AWS from 'aws-sdk'

export const TEST_DYNAMODB_TABLE_NAME_PREFIX = '__test__'
// We use a separate table for each jest worker. Then different test files running in parallel
// won't interfere with each other.
export const TEST_DYNAMODB_TABLE_NAME = `${TEST_DYNAMODB_TABLE_NAME_PREFIX}${process.env.JEST_WORKER_ID}`

export function getTestDynamoDbClient(): AWS.DynamoDB.DocumentClient {
  return new AWS.DynamoDB.DocumentClient({
    credentials: undefined,
    endpoint: 'http://localhost:8000',
    region: 'us-east-2',
  })
}

export function getTestDynamoDb(): AWS.DynamoDB {
  return new AWS.DynamoDB({
    credentials: undefined,
    endpoint: 'http://localhost:8000',
    region: 'us-east-2',
  })
}

export function dynamoDbSetupHook() {
  beforeAll(() => {
    try {
      execSync(`npm run recreate-local-ddb --table=${TEST_DYNAMODB_TABLE_NAME}`)
    } catch (e) {
      console.error(
        `Please start local dynamodb first by running 'npm run start-local-ddb'`
      )
      exit(1)
    }
  })
}
