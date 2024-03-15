import {
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb'
import { backOff } from 'exponential-backoff'
import { range } from 'lodash'

export const TEST_DYNAMODB_TABLE_NAME_PREFIX = '__test__'
// We use a separate table for each jest worker. Then different test files running in parallel
// won't interfere with each other.
export const TEST_DYNAMODB_TABLE_NAMES = range(0, 4).map(
  (i) => `${TEST_DYNAMODB_TABLE_NAME_PREFIX}${process.env.JEST_WORKER_ID}-${i}`
)

export async function recreateTables() {
  for (const table of TEST_DYNAMODB_TABLE_NAMES) {
    await recreateTable(table)
  }
}

async function recreateTable(tableName: string) {
  await backOff(
    async () => {
      await deleteTable(tableName)
      await createTable(tableName)
    },
    {
      startingDelay: 1000,
      maxDelay: 2000,
      jitter: 'full',
      numOfAttempts: 100,
    }
  )
}

async function createTable(tableName: string) {
  try {
    const { getDynamoDbRawClient } = await import('@/utils/dynamodb')
    const dynamodb = getDynamoDbRawClient()
    await dynamodb.send(new CreateTableCommand(createSchema(tableName)))
    dynamodb.destroy()
    return
  } catch (e: any) {
    if (e?.message?.includes('Cannot create preexisting table')) {
      return
    }
    throw new Error(
      `Unable to create table "${tableName}"; ${e?.message ?? 'Unknown error'}`
    )
  }
}

async function deleteTable(tableName: string) {
  try {
    const { getDynamoDbRawClient } = await import('@/utils/dynamodb')
    const dynamodb = getDynamoDbRawClient()
    await dynamodb.send(new DeleteTableCommand({ TableName: tableName }))
    dynamodb.destroy()
  } catch (e: any) {
    // ignore if table does not exist
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
