import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient, Collection } from 'mongodb'
import isEqual from 'lodash/isEqual'
import pick from 'lodash/pick'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { migrateAllTenants } from '../utils/tenant'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { Tenant } from '@/@types/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { API_REQUEST_LOGS_COLLECTION } from '@/utils/mongo-table-names'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { getSQSClient } from '@/utils/sns-sqs-client'
import {
  DynamoDbEntityType,
  DynamoDbEntityUpdate,
} from '@/core/dynamodb/dynamodb-stream-utils'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { Business } from '@/@types/openapi-public/Business'
import { User } from '@/@types/openapi-public/all'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { UserEventRepository } from '@/services/rules-engine/repositories/user-event-repository'
import { isConsumerUser } from '@/services/rules-engine/utils/user-rule-utils'

/* Considering requests from 2 days prior and 2 days pastthe suspension timeline
 to consider requests that might have been in the process of being consumed and got queued. 
*/
const suspendedTimeline = {
  start: 1731369600000, // November 12, 2024 12:00:00 AM
  end: 1732233600000, // November 22, 2024 12:00:00 AM
}

interface SendEntityToSQSParams {
  tenantId: string
  entityId: string
  type: DynamoDbEntityType
  keys: { PartitionKeyID: string; SortKeyID?: string }
  data: any
  sqsClient: SQSClient
}
async function sendEntityToSQS({
  tenantId,
  entityId,
  type,
  keys,
  data,
  sqsClient,
}: SendEntityToSQSParams) {
  const entityData: DynamoDbEntityUpdate = {
    tenantId,
    partitionKeyId: keys.PartitionKeyID,
    sortKeyId: keys.SortKeyID,
    entityId: entityId,
    NewImage: data,
    type,
  }

  await sqsClient.send(
    new SendMessageCommand({
      MessageBody: JSON.stringify(entityData),
      QueueUrl: process.env.DOWNSTREAM_TARPON_QUEUE_URL,
    })
  )
}

interface ProcessEntityParams {
  tenantId: string
  collection: Collection
  matchPaths: string[]
  idField: string
  handler: (
    tenantId: string,
    entityId: string,
    clients: Clients
  ) => Promise<void>
}

interface Clients {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  sqsClient: SQSClient
}

function createAggregationPipeline(matchPaths: string[], idField: string) {
  return [
    {
      $match: {
        method: 'POST',
        timestamp: {
          $gte: suspendedTimeline.start,
          $lte: suspendedTimeline.end,
        },
        path: { $in: matchPaths },
      },
    },
    { $sort: { timeStamp: 1 } },
    {
      $group: {
        _id: `$payload.${idField}`,
        entityId: { $last: `$payload.${idField}` },
      },
    },
  ]
}

async function processEntities({
  tenantId,
  collection,
  matchPaths,
  idField,
  handler,
  clients,
}: ProcessEntityParams & { clients: Clients }) {
  let count = 0
  const cursor = collection.aggregate(
    createAggregationPipeline(matchPaths, idField)
  )

  await processCursorInBatch(
    cursor,
    async (requests) => {
      await Promise.all(
        requests.map((request) => handler(tenantId, request.entityId, clients))
      )
      count += requests.length
    },
    {
      mongoBatchSize: 500,
      processBatchSize: 50,
    }
  )
  return count
}

async function migrateTenant(tenant: Tenant) {
  if (tenant.id !== '52f4662976') {
    return
  }

  const clients = {
    dynamoDb: getDynamoDbClient(),
    mongoDb: await getMongoDbClient(),
    sqsClient: getSQSClient(),
  }

  const requestCollection = clients.mongoDb
    .db()
    .collection(API_REQUEST_LOGS_COLLECTION(tenant.id))

  const txCount = await processEntities({
    tenantId: tenant.id,
    collection: requestCollection,
    matchPaths: ['/transactions', '/events/transaction'],
    idField: 'transactionId',
    handler: handleTransaction,
    clients,
  })
  console.log(`Processed ${txCount} transactions`)

  const userCount = await processEntities({
    tenantId: tenant.id,
    collection: requestCollection,
    matchPaths: [
      '/consumer/users',
      '/business/users',
      '/events/consumer/user',
      '/events/business/user',
    ],
    idField: 'userId',
    handler: handleUser,
    clients,
  })
  console.log(`Processed ${userCount} users`)
}

async function handleUser(tenantId: string, userId: string, clients: Clients) {
  const { dynamoDb, mongoDb, sqsClient } = clients
  if (!userId) {
    return
  }

  const usersRepository = new UserRepository(tenantId, { dynamoDb, mongoDb })
  const userEventRepository = new UserEventRepository(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const [userInMongo, userInDynamo] = await Promise.all([
    usersRepository.getUserById(userId),
    usersRepository.getUser<User | Business>(userId),
  ])
  if (!userInDynamo) {
    return
  }
  const partialMongoUser = pick(
    userInMongo,
    UserWithRulesResult.getAttributeTypeMap().map((v) => v.name)
  )
  if (isEqual(partialMongoUser, userInDynamo)) {
    return
  }
  console.log(`Syncing data for user with Id: ${userId}`)
  // Send user details to SQS
  await sendEntityToSQS({
    tenantId,
    entityId: `USER:${userId}`,
    type: 'USER',
    keys: DynamoDbKeys.USER(tenantId, userId),
    data: userInDynamo,
    sqsClient,
  })

  // Get risk scores
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const [krsScore, drsScore] = await Promise.all([
    riskRepository.getKrsScore(userId),
    riskRepository.getDrsScore(userId),
  ])
  const isConsumer = isConsumerUser(userInDynamo)
  const userEvents = isConsumer
    ? await userEventRepository.getConsumerUserEvents(userId)
    : await userEventRepository.getBusinessUserEvents(userId)
  // Send KRS and DRS scores to SQS
  await Promise.all([
    ...userEvents.map((event) =>
      sendEntityToSQS({
        tenantId,
        entityId: `USER:${userId}`,
        type: isConsumer ? 'CONSUMER_USER_EVENT' : 'BUSINESS_USER_EVENT',
        keys: isConsumer
          ? DynamoDbKeys.CONSUMER_USER_EVENT(tenantId, userId, event.timestamp)
          : DynamoDbKeys.BUSINESS_USER_EVENT(tenantId, userId, event.timestamp),
        data: event,
        sqsClient,
      })
    ),
    sendEntityToSQS({
      tenantId,
      entityId: `USER:${userId}`,
      type: 'KRS_VALUE',
      keys: DynamoDbKeys.KRS_VALUE_ITEM(tenantId, userId, '1'),
      data: krsScore || {},
      sqsClient,
    }),
    sendEntityToSQS({
      tenantId,
      entityId: `USER:${userId}`,
      type: 'DRS_VALUE',
      keys: DynamoDbKeys.DRS_VALUE_ITEM(tenantId, userId, '1'),
      data: drsScore || {},
      sqsClient,
    }),
  ])
}

async function handleTransaction(
  tenantId: string,
  transactionId: string,
  clients: Clients
) {
  const { dynamoDb, mongoDb, sqsClient } = clients
  if (!transactionId) {
    return
  }
  const transactionsRepository = new DynamoDbTransactionRepository(
    tenantId,
    dynamoDb
  )
  const mongoTransactionsRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb,
    dynamoDb
  )
  const transactionEventRepository = new TransactionEventRepository(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const [dynamoTransaction, mongoTransaction] = await Promise.all([
    transactionsRepository.getTransactionById(transactionId),
    mongoTransactionsRepository.getTransactionById(transactionId),
  ])
  if (!dynamoTransaction) {
    return
  }
  const partialMongoTransaction = pick(
    mongoTransaction,
    TransactionWithRulesResult.getAttributeTypeMap().map((v) => v.name)
  )
  if (isEqual(partialMongoTransaction, dynamoTransaction)) {
    return
  }
  console.log(`Syncing data for transaction with Id: ${transactionId}`)
  const transactionKeys = DynamoDbKeys.TRANSACTION(
    tenantId,
    transactionId,
    dynamoTransaction.timestamp
  )
  // Send transaction to SQS
  await sendEntityToSQS({
    tenantId,
    entityId: `TRANSACTION:${transactionId}`,
    type: 'TRANSACTION',
    keys: transactionKeys,
    data: dynamoTransaction,
    sqsClient,
  })
  // Sync ARS score by sending to SQS
  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const arsScore = await riskRepository.getArsScore(transactionId)
  const transactionEventsInDynamo =
    await transactionEventRepository.getTransactionEvents(transactionId)

  await Promise.all([
    ...transactionEventsInDynamo.map((event) =>
      sendEntityToSQS({
        tenantId,
        entityId: `TRANSACTION:${transactionId}`,
        type: 'TRANSACTION_EVENT',
        keys: DynamoDbKeys.TRANSACTION_EVENT(tenantId, transactionId, {
          eventId: event.eventId ?? '',
          timestamp: event.timestamp,
        }),
        data: event,
        sqsClient,
      })
    ),
    sendEntityToSQS({
      tenantId,
      entityId: `TRANSACTION:${transactionId}`,
      type: 'ARS_VALUE',
      keys: DynamoDbKeys.ARS_VALUE_ITEM(tenantId, transactionId, '1'),
      data: arsScore,
      sqsClient,
    }),
  ])
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
