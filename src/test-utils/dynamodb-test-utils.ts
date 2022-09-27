import AWS, { DynamoDB } from 'aws-sdk'
import _ from 'lodash'

export const TEST_DYNAMODB_TABLE_NAME_PREFIX = '__test__'
// We use a separate table for each jest worker. Then different test files running in parallel
// won't interfere with each other.
export const TEST_DYNAMODB_TABLE_NAMES = _.range(0, 4).map(
  (i) => `${TEST_DYNAMODB_TABLE_NAME_PREFIX}${process.env.JEST_WORKER_ID}-${i}`
)

export function getTestDynamoDbClient(): AWS.DynamoDB.DocumentClient {
  return new AWS.DynamoDB.DocumentClient({
    credentials: {
      accessKeyId: 'fake',
      secretAccessKey: 'fake',
    },
    endpoint: 'http://localhost:8000',
    region: 'local',
  })
}

export function getTestDynamoDb(): AWS.DynamoDB {
  return new AWS.DynamoDB({
    credentials: {
      accessKeyId: 'fake',
      secretAccessKey: 'fake',
    },
    endpoint: 'http://localhost:8000',
    region: 'local',
  })
}

export function dynamoDbSetupHook() {
  beforeAll(async () => {
    for (const table of TEST_DYNAMODB_TABLE_NAMES) {
      await deleteTable(table, true)
      await createTable(table)
    }
  })
}

async function createTable(tableName: string) {
  const dynamo = getTestDynamoDb()
  try {
    await dynamo.createTable(createSchema(tableName)).promise()
  } catch (e: any) {
    throw new Error(
      `Unable to create table "${tableName}"; ${e.message ?? 'Unknown error'}`
    )
  }
}

async function deleteTable(tableName: string, silent = false) {
  const dynamo = getTestDynamoDb()
  try {
    await dynamo.deleteTable({ TableName: tableName }).promise()
  } catch (e: any) {
    if (!silent) {
      throw new Error(
        `Unable to delete table "${tableName}"; ${e.message ?? 'Unknown error'}`
      )
    }
  }
}

function createSchema(tableName: string): DynamoDB.Types.CreateTableInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [
      {
        AttributeName: 'PartitionKeyID',
        AttributeType: 'S',
      },
      {
        AttributeName: 'SortKeyID',
        AttributeType: 'S',
      },
    ],
    KeySchema: [
      {
        AttributeName: 'PartitionKeyID',
        KeyType: 'HASH',
      },
      {
        AttributeName: 'SortKeyID',
        KeyType: 'RANGE',
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
  }
}
