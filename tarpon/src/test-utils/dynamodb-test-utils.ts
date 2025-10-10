import {
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import { backOff } from 'exponential-backoff'
import range from 'lodash/range'

export const TEST_DYNAMODB_TABLE_NAME_PREFIX = '__test__'
// We use a separate table for each jest worker. Then different test files running in parallel
// won't interfere with each other.
export const TEST_DYNAMODB_TABLE_NAMES = range(0, 4).map(
  (i) => `${TEST_DYNAMODB_TABLE_NAME_PREFIX}${process.env.JEST_WORKER_ID}-${i}`
)

const retryOptions = {
  startingDelay: 2000,
  maxDelay: 2000,
  numOfAttempts: 10,
} as const
export function dynamoDbSetupHook() {
  beforeAll(async () => {
    for (const table of TEST_DYNAMODB_TABLE_NAMES) {
      await backOff(() => deleteTable(table, true), retryOptions)
      await backOff(() => createTable(table), retryOptions)
    }
  })
  afterAll(() => {
    const __dynamoDbClientsForTesting__ =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('@/utils/dynamodb')
        .__dynamoDbClientsForTesting__ as DynamoDBClient[]
    __dynamoDbClientsForTesting__.forEach((c) => c.destroy())
    __dynamoDbClientsForTesting__.length = 0
  })
}

async function createTable(tableName: string) {
  try {
    const { getDynamoDbRawClient } = await import('@/utils/dynamodb')
    const dynamodb = getDynamoDbRawClient()
    await dynamodb.send(new CreateTableCommand(createSchema(tableName)))
    dynamodb.destroy()
    return
  } catch (e: any) {
    throw new Error(
      `Unable to create table "${tableName}"; ${e?.message ?? 'Unknown error'}`
    )
  }
}

async function deleteTable(tableName: string, silent = false) {
  try {
    const { getDynamoDbRawClient } = await import('@/utils/dynamodb')
    const dynamodb = getDynamoDbRawClient()
    await dynamodb.send(new DeleteTableCommand({ TableName: tableName }))
    dynamodb.destroy()
  } catch (e: any) {
    if (!silent) {
      throw new Error(
        `Unable to delete table "${tableName}"; ${e.message ?? 'Unknown error'}`
      )
    }
  }
}

function createSchema(tableName: string): CreateTableInput {
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
