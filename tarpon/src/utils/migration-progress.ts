import {
  QueryCommand,
  QueryCommandInput,
  UpdateCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { ObjectId } from 'mongodb'
import { StackConstants } from '@lib/constants'
import { isClickhouseMigrationEnabled } from './clickhouse/utils'
import { envIs } from './env'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  getDynamoDbClient,
  sanitizeMongoObject,
  transactWrite,
  TransactWriteOperation,
} from '@/utils/dynamodb'
import { MIGRATION_TMP_COLLECTION } from '@/utils/mongodb-definitions'
import { getMongoDbClient } from '@/utils/mongodb-utils'

const TableName = envIs('test')
  ? StackConstants.TARPON_DYNAMODB_TABLE_NAME('test')
  : 'Tarpon'

async function getMigrationFromDynamo(migrationKey: string) {
  const dynamoDb = getDynamoDbClient()
  const partitionKey = DynamoDbKeys.MIGRATION_TMP(migrationKey).PartitionKeyID
  const commandInput: QueryCommandInput = {
    TableName,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': partitionKey,
    },
    Limit: 1,
    ConsistentRead: true,
    ScanIndexForward: false,
  }

  const command = new QueryCommand(commandInput)
  const result = await dynamoDb.send(command)
  return result.Items?.[0] ?? null
}

export async function getMigrationLastCompletedTimestamp(
  migrationKey: string
): Promise<number | undefined> {
  if (isClickhouseMigrationEnabled()) {
    const migration = await getMigrationFromDynamo(migrationKey)
    return migration?.lastCompletedTimestamp
  }
  const mongoDb = (await getMongoDbClient()).db()
  const migrationProgress = await mongoDb
    .collection(MIGRATION_TMP_COLLECTION)
    .findOne({ _id: migrationKey as any })
  return migrationProgress?.lastCompletedTimestamp
}

export async function updateMigrationLastCompletedTimestamp(
  migrationKey: string,
  lastCompletedTimestamp: number
) {
  const dynamoDb = getDynamoDbClient()
  const key = DynamoDbKeys.MIGRATION_TMP(migrationKey)

  const command = new UpdateCommand({
    TableName,
    Key: key,
    UpdateExpression: 'SET #timestamp = :timestamp',
    ExpressionAttributeNames: {
      '#timestamp': 'lastCompletedTimestamp',
    },
    ExpressionAttributeValues: {
      ':timestamp': lastCompletedTimestamp,
    },
  })

  await dynamoDb.send(command)

  const mongoDb = (await getMongoDbClient()).db()
  await mongoDb.collection(MIGRATION_TMP_COLLECTION).replaceOne(
    {
      _id: migrationKey as any,
    },
    { lastCompletedTimestamp },
    { upsert: true }
  )
}

export async function getMigrationLastCompletedId(migrationKey: string) {
  if (isClickhouseMigrationEnabled()) {
    const migration = await getMigrationFromDynamo(migrationKey)
    return migration?.lastCompletedId
  }
  const mongoDb = (await getMongoDbClient()).db()
  const migrationProgress = await mongoDb
    .collection(MIGRATION_TMP_COLLECTION)
    .findOne({ _id: migrationKey as any })
  return migrationProgress?.lastCompletedId
}

export async function updateMigrationLastCompletedId(
  migrationKey: string,
  lastCompletedId: string
) {
  const dynamoDb = getDynamoDbClient()
  const key = DynamoDbKeys.MIGRATION_TMP(migrationKey)
  const updateCommand = new UpdateCommand({
    TableName,
    Key: key,
    UpdateExpression: 'SET lastCompletedId = :id',
    ExpressionAttributeValues: { ':id': lastCompletedId },
  })
  await dynamoDb.send(updateCommand)
  const mongoDb = (await getMongoDbClient()).db()
  await mongoDb
    .collection(MIGRATION_TMP_COLLECTION)
    .updateOne(
      { _id: migrationKey as any },
      { $set: { lastCompletedId } },
      { upsert: true }
    )
}

export async function saveMigrationTmpProgressToDynamo(migrationTmp: any[]) {
  const dynamoDb = getDynamoDbClient()
  const writeRequests: TransactWriteOperation[] = []
  for (const migration of migrationTmp) {
    if (!migration._id) {
      continue
    }
    const key = DynamoDbKeys.MIGRATION_TMP(migration._id)
    writeRequests.push({
      Put: {
        TableName,
        Item: {
          ...key,
          ...sanitizeMongoObject(migration),
        },
      },
    })
  }
  await transactWrite(dynamoDb, writeRequests)
}

export type Migration = {
  _id?: ObjectId | string
  migrationName: string
}
export async function saveMigrationProgressToDynamo(
  migrations: Migration[],
  migrationType: 'PRE_DEPLOYMENT' | 'POST_DEPLOYMENT'
) {
  const dynamoDb = getDynamoDbClient()

  for (const migration of migrations) {
    let key: {
      PartitionKeyID: string
      SortKeyID: string
    }
    if (!migration.migrationName) {
      continue
    }
    if (migrationType === 'PRE_DEPLOYMENT') {
      key = DynamoDbKeys.MIGRATION_PRE_DEPLOYMENT(migration.migrationName)
    } else {
      key = DynamoDbKeys.MIGRATION_POST_DEPLOYMENT(migration.migrationName)
    }

    const command = new PutCommand({
      TableName,
      Item: {
        ...key,
        ...sanitizeMongoObject(migration),
      },
    })

    await dynamoDb.send(command)
  }
}
