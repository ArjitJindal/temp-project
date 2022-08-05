import { exit } from 'process'
import AWS from 'aws-sdk'
import { program } from 'commander'
import { TarponStackConstants } from '@cdk/constants'
import { Db } from 'mongodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { paginateQueryGenerator } from '@/utils/dynamodb'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { getReceiverKeys, getSenderKeys } from '@/services/rules-engine/utils'
import {
  connectToDB,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  IMPORT_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'

type DynamoDbKey = { PartitionKeyID: string; SortKeyID: string }

const ENV_TO_PROFILE: { [key: string]: string } = {
  dev: 'AWSAdministratorAccess-911899431626',
  sandbox: 'AWSAdministratorAccess-293986822825',
  prod: 'AWSAdministratorAccess-870721492449',
}

type TYPES = 'transaction' | 'user' | 'rule-instance' | 'dashboard' | 'import'
const TYPES: TYPES[] = [
  'transaction',
  'user',
  'rule-instance',
  'dashboard',
  'import',
]
let allMongoDbCollections: string[] = []

program
  .argument('tenant ID')
  .option('--types <string...>', TYPES.join(' | '))
  .option('--env <string>', 'local | dev | sandbox | prod', 'local')
  .option('--region <string>', 'AWS region', 'dummy')
  .parse()

const tenantId = program.args[0]
const { env, region, types } = program.opts()

if (env === 'local') {
  process.env.MONGO_URI = 'mongodb://localhost:27017'
  process.env.ENV = 'local'
}

let mongoDb: Db
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region,
  credentials:
    env === 'local'
      ? undefined
      : new AWS.SharedIniFileCredentials({
          profile: ENV_TO_PROFILE[env],
        }),
  endpoint: env === 'local' ? 'http://localhost:8000' : undefined,
})
const deletedUserAggregationUserIds = new Set()

async function dropMongoDbCollection(collectionName: string) {
  if (allMongoDbCollections.includes(collectionName)) {
    await mongoDb.collection(collectionName).drop()
    logger.info(`Dropped mongodb collection - ${collectionName}`)
  }
}

async function deleteTransaction(transaction: Transaction) {
  await deleteUserAggregation(transaction.originUserId)
  await deleteUserAggregation(transaction.destinationUserId)

  const keysToDelete = [
    getSenderKeys(tenantId, transaction),
    getSenderKeys(tenantId, transaction, transaction.type),
    getReceiverKeys(tenantId, transaction),
    getReceiverKeys(tenantId, transaction, transaction.type),
    transaction?.deviceData?.ipAddress &&
      DynamoDbKeys.IP_ADDRESS_TRANSACTION(
        tenantId,
        transaction.deviceData.ipAddress,
        transaction.timestamp
      ),
    // Always delete the primary transaction item at last to avoid having zombie indices that
    // can not be deleted.
    DynamoDbKeys.TRANSACTION(tenantId, transaction.transactionId),
  ].filter(Boolean) as Array<DynamoDbKey>
  for (const key of keysToDelete) {
    await deletePartitionKey('transaction', key)
  }
}

async function deleteTransactions() {
  const transactionsQueryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': DynamoDbKeys.TRANSACTION(tenantId).PartitionKeyID,
    },
    ReturnConsumedCapacity: 'TOTAL',
  }
  for await (const transactionsResult of paginateQueryGenerator(
    dynamoDb,
    transactionsQueryInput
  )) {
    for (const transaction of (transactionsResult.Items ||
      []) as Transaction[]) {
      try {
        await deleteTransaction(transaction)
      } catch (e) {
        logger.error(
          `Failed to delete transaction ${transaction.transactionId} - ${e}`
        )
        throw e
      }
    }
  }
  await dropMongoDbCollection(TRANSACTIONS_COLLECTION(tenantId))
}

async function deletePartitionKey(entityName: string, key: DynamoDbKey) {
  await dynamoDb
    .delete({
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: key,
    })
    .promise()
  logger.info(`Deleted ${entityName} ${JSON.stringify(key)}`)
}

async function deletePartition(entityName: string, partitionKeyId: string) {
  const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': partitionKeyId,
    },
    ProjectionExpression: 'PartitionKeyID,SortKeyID',
  }
  for await (const result of paginateQueryGenerator(dynamoDb, queryInput)) {
    for (const item of result.Items || []) {
      try {
        await deletePartitionKey(entityName, item as DynamoDbKey)
      } catch (e) {
        logger.error(`Failed to delete ${entityName} ${item} - ${e}`)
        throw e
      }
    }
  }
}

async function deleteUserAggregation(userId: string | undefined) {
  if (!userId || deletedUserAggregationUserIds.has(userId)) {
    return
  }
  await deletePartition(
    'user aggregation',
    DynamoDbKeys.USER_AGGREGATION(tenantId, userId).PartitionKeyID
  )
  await deletePartition(
    'user aggregation (time)',
    DynamoDbKeys.USER_TIME_AGGREGATION(tenantId, userId).PartitionKeyID
  )
  deletedUserAggregationUserIds.add(userId)
}

async function deleteUser(userId: string) {
  await deleteUserAggregation(userId)
  await deletePartitionKey(
    'user',
    DynamoDbKeys.USER(tenantId, userId) as DynamoDbKey
  )
}

async function deleteUsers() {
  const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': DynamoDbKeys.USER(tenantId).PartitionKeyID,
    },
    ProjectionExpression: 'PartitionKeyID,SortKeyID',
  }
  for await (const result of paginateQueryGenerator(dynamoDb, queryInput)) {
    for (const item of (result.Items || []) as DynamoDbKey[]) {
      try {
        await deleteUser(item.SortKeyID)
      } catch (e) {
        logger.error(`Failed to delete user ${item.SortKeyID} - ${e}`)
        throw e
      }
    }
  }
  await dropMongoDbCollection(USERS_COLLECTION(tenantId))
  await dropMongoDbCollection(USER_EVENTS_COLLECTION(tenantId))
}

async function deleteRuleInstances() {
  await deletePartition(
    'rule instance',
    DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID
  )
}

async function deleteDashboardStats() {
  await dropMongoDbCollection(
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)
  )
  await dropMongoDbCollection(
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)
  )
  await dropMongoDbCollection(
    DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
  )
}

async function deleteImports() {
  // TODO: Delete S3 files
  await dropMongoDbCollection(IMPORT_COLLECTION(tenantId))
}

async function nukeTenantData(tenantId: string) {
  const typesToDelete = (types || TYPES) as TYPES[]
  logger.info(
    `Starting to nuke data for tenant ${tenantId} (${typesToDelete.join(
      ','
    )})... (${env}: ${region})`
  )
  mongoDb = (await connectToDB()).db()
  allMongoDbCollections = (await mongoDb.listCollections().toArray()).map(
    (collection) => collection.name
  )

  if (typesToDelete.includes('transaction')) {
    await deleteTransactions()
  }
  if (typesToDelete.includes('user')) {
    await deleteUsers()
  }
  if (typesToDelete.includes('rule-instance')) {
    await deleteRuleInstances()
  }
  if (typesToDelete.includes('dashboard')) {
    await deleteDashboardStats()
  }
  if (typesToDelete.includes('import')) {
    await deleteImports()
  }
}

nukeTenantData(tenantId)
  .then(() => exit(0))
  .catch((e) => {
    logger.error(e)
    exit(1)
  })
