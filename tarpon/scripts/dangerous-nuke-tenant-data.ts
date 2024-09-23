/**
 * Delete tenant data in bulk
 * Example usage:
 * ```
 * ENV=dev npm run dangerous-nuke-tenant-data -- tenantId --types transaction
 * ENV=sandbox npm run dangerous-nuke-tenant-data -- tenantId --types transaction,user
 * ENV=prod:eu-1 npm run dangerous-nuke-tenant-data -- tenantId --types transaction,user
 * ```
 */

import { exit } from 'process'
import { program } from 'commander'
import { StackConstants } from '@lib/constants'
import { Db } from 'mongodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { loadConfigEnv } from './migrations/utils/config'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getDynamoDbClient, paginateQueryGenerator } from '@/utils/dynamodb'
import { Transaction } from '@/@types/openapi-public/Transaction'
import {
  getNonUserReceiverKeys,
  getNonUserSenderKeys,
  getReceiverKeys,
  getSenderKeys,
  getUserReceiverKeys,
  getUserSenderKeys,
} from '@/services/rules-engine/utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  IMPORT_COLLECTION,
  KRS_SCORES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { logger } from '@/core/logger'

type DynamoDbKey = { PartitionKeyID: string; SortKeyID: string }

type TYPES =
  | 'transaction'
  | 'user'
  | 'rule-instance'
  | 'dashboard'
  | 'import'
  | 'parameter-risk-values'
  | 'krs-risk-values'

const TYPES: TYPES[] = [
  'transaction',
  'user',
  'rule-instance',
  'dashboard',
  'import',
  'parameter-risk-values',
  'krs-risk-values',
]
let allMongoDbCollections: string[] = []

program
  .argument('Tenant ID')
  .requiredOption('--types <string...>', TYPES.join(' | '))
  .parse()

const tenantId = program.args[0]
const { types = [] } = program.opts()

loadConfigEnv()

let mongoDb: Db
let dynamoDb: DynamoDBDocumentClient
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
  await deletePartition(
    'transaction event',
    DynamoDbKeys.TRANSACTION_EVENT(
      tenantId,
      transaction.transactionId as string
    ).PartitionKeyID
  )

  const originIpAddress = transaction?.originDeviceData?.ipAddress
  const destinationIpAddress = transaction?.destinationDeviceData?.ipAddress

  const keysToDelete = [
    getSenderKeys(tenantId, transaction),
    getSenderKeys(tenantId, transaction, transaction.type),
    getUserSenderKeys(tenantId, transaction),
    getUserSenderKeys(tenantId, transaction, transaction.type),
    getNonUserSenderKeys(tenantId, transaction),
    getNonUserSenderKeys(tenantId, transaction, transaction.type),
    getReceiverKeys(tenantId, transaction),
    getReceiverKeys(tenantId, transaction, transaction.type),
    getUserReceiverKeys(tenantId, transaction),
    getUserReceiverKeys(tenantId, transaction, transaction.type),
    getNonUserReceiverKeys(tenantId, transaction),
    getNonUserReceiverKeys(tenantId, transaction, transaction.type),
    originIpAddress &&
      DynamoDbKeys.ORIGIN_IP_ADDRESS_TRANSACTION(tenantId, originIpAddress, {
        timestamp: transaction.timestamp,
        transactionId: transaction.transactionId,
      }),
    destinationIpAddress &&
      DynamoDbKeys.DESTINATION_IP_ADDRESS_TRANSACTION(
        tenantId,
        destinationIpAddress,
        {
          timestamp: transaction.timestamp,
          transactionId: transaction.transactionId,
        }
      ),
    // Always delete the primary transaction item at last to avoid having zombie indexes that
    // can not be deleted.
    DynamoDbKeys.TRANSACTION(tenantId, transaction.transactionId),
  ].filter(Boolean) as Array<DynamoDbKey>
  for (const key of keysToDelete) {
    await deletePartitionKey('transaction', key)
  }
}

async function deleteTransactions() {
  const transactionsQueryInput: QueryCommandInput = {
    TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': DynamoDbKeys.TRANSACTION(tenantId).PartitionKeyID,
    },
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

async function deletePartitionKey(
  entityName: string,
  key: DynamoDbKey,
  tableName?: string
) {
  await dynamoDb.send(
    new DeleteCommand({
      TableName: tableName
        ? tableName
        : StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
      Key: key,
    })
  )
  logger.info(`Deleted ${entityName} ${JSON.stringify(key)}`)
}

async function deletePartition(
  entityName: string,
  partitionKeyId: string,
  tableName?: string
) {
  const queryInput: QueryCommandInput = {
    TableName: tableName
      ? tableName
      : StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
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
  await deletePartition(
    'consumer user event',
    DynamoDbKeys.CONSUMER_USER_EVENT(tenantId, userId).PartitionKeyID
  )
  await deletePartition(
    'business user event',
    DynamoDbKeys.BUSINESS_USER_EVENT(tenantId, userId).PartitionKeyID
  )
  await deletePartitionKey(
    'user',
    DynamoDbKeys.USER(tenantId, userId) as DynamoDbKey
  )
}

async function deleteUsers() {
  const queryInput: QueryCommandInput = {
    TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
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

async function deleteParameterRiskValues() {
  await deletePartition(
    'provided parameter risk values',
    DynamoDbKeys.PARAMETER_RISK_SCORES_DETAILS(tenantId).PartitionKeyID,
    StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
  )
}

async function deleteRiskValue(userId: string) {
  await deletePartitionKey(
    'user risk score',
    DynamoDbKeys.KRS_VALUE_ITEM(tenantId, userId, '1') as DynamoDbKey,
    StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
  )
}

async function deleteKrsValues() {
  const queryInput: QueryCommandInput = {
    TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
    KeyConditionExpression: 'PartitionKeyID = :pk',
    ExpressionAttributeValues: {
      ':pk': DynamoDbKeys.USER(tenantId).PartitionKeyID,
    },
    ProjectionExpression: 'PartitionKeyID,SortKeyID',
  }
  for await (const result of paginateQueryGenerator(dynamoDb, queryInput)) {
    for (const item of (result.Items || []) as DynamoDbKey[]) {
      try {
        await deleteRiskValue(item.SortKeyID)
      } catch (e) {
        logger.error(
          `Failed to delete KRS Risk Value for user: ${item.SortKeyID} - ${e}`
        )
        throw e
      }
    }
  }
  await dropMongoDbCollection(KRS_SCORES_COLLECTION(tenantId))
}

async function nukeTenantData(tenantId: string) {
  const typesToDelete = types as TYPES[]
  logger.info(
    `Starting to nuke data for tenant ${tenantId} (types: ${typesToDelete.join(
      ','
    )})...`
  )
  dynamoDb = await getDynamoDbClient()
  mongoDb = (await getMongoDbClient()).db()
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
  if (typesToDelete.includes('parameter-risk-values')) {
    await deleteParameterRiskValues()
  }
  if (typesToDelete.includes('krs-risk-values')) {
    await deleteKrsValues()
  }
}

nukeTenantData(tenantId)
  .then(() => exit(0))
  .catch((e) => {
    logger.error(e)
    exit(1)
  })
