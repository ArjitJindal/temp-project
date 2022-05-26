import { v4 as uuidv4 } from 'uuid'
import { Filter, FindCursor, MongoClient } from 'mongodb'
import _, { chunk } from 'lodash'
import { TarponStackConstants } from '@cdk/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import { getReceiverKeys, getSenderKeys } from '../utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getTimstampBasedIDPrefix } from '@/utils/timestampUtils'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { FailedRulesResult } from '@/@types/openapi-public/FailedRulesResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongoDBUtils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { TransactionStatusChange } from '@/@types/openapi-internal/TransactionStatusChange'
import { paginateQuery } from '@/utils/dynamodb'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'

type QueryCountResult = { count: number; scannedCount: number }
type TimeRange = {
  beforeTimestamp: number
  afterTimestamp: number
}

export class TransactionRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: AWS.DynamoDB.DocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as AWS.DynamoDB.DocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  /* MongoDB operations */

  public getTransactionsMongoQuery(
    params: DefaultApiGetTransactionsListRequest
  ): Filter<TransactionCaseManagement> {
    const query: Filter<TransactionCaseManagement> = {
      timestamp: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp,
      },
    }
    if (params.filterId != null) {
      query['transactionId'] = { $regex: params.filterId }
    }
    if (params.filterOutStatus != null) {
      query['status'] = { $ne: params.filterOutStatus }
    }

    const executedRulesFilters = []
    if (params.filterRulesExecuted != null) {
      executedRulesFilters.push({
        $elemMatch: { ruleId: { $in: params.filterRulesExecuted } },
      })
    }
    if (params.filterRulesHit != null) {
      executedRulesFilters.push({
        $elemMatch: {
          ruleHit: true,
          ruleId: { $in: params.filterRulesExecuted },
        },
      })
    }
    if (executedRulesFilters.length > 0) {
      query['executedRules'] = {
        $all: executedRulesFilters,
      }
    }

    return query
  }

  public async getTransactionsCursor(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<FindCursor<TransactionCaseManagement>> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const query = this.getTransactionsMongoQuery(params)
    return collection.find(query).sort({ timestamp: -1 })
  }

  public async getTransactionsCount(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<number> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const query = this.getTransactionsMongoQuery(params)
    return collection.countDocuments(query)
  }

  public async getTransactions(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<{ total: number; data: TransactionCaseManagement[] }> {
    const cursor = await this.getTransactionsCursor(params)
    const total = await this.getTransactionsCount(params)
    const transactions = await cursor
      .limit(params.limit)
      .skip(params.skip)
      .toArray()
    return { total, data: transactions }
  }

  public async getTransactionsPerUser(
    pagination: {
      limit: number
      skip: number
      afterTimestamp?: number
      beforeTimestamp: number
    },
    userId: string
  ): Promise<{ total: number; data: TransactionCaseManagement[] }> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    const query = {
      timestamp: {
        $gte: pagination.afterTimestamp || 0,
        $lte: pagination.beforeTimestamp,
      },
      originUserId: userId,
    }

    const transactions = await collection
      .find(query)
      .sort({ timestamp: -1 })
      .limit(pagination.limit)
      .skip(pagination.skip)
      .toArray()
    const total = await collection.count(query)
    return { total, data: transactions }
  }

  public async updateTransactionCaseManagement(
    transactionId: string,
    updates: {
      assignments?: Assignment[]
      status?: RuleAction
      statusChange?: TransactionStatusChange
    }
  ) {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      { transactionId },
      {
        $set: _.omitBy<Partial<TransactionCaseManagement>>(
          { assignments: updates.assignments, status: updates.status },
          _.isNil
        ),
        ...(updates.statusChange
          ? { $push: { statusChanges: updates.statusChange } }
          : {}),
      }
    )
  }

  public async getTransactionCaseManagement(
    transactionId: string
  ): Promise<TransactionCaseManagement | null> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    return await collection.findOne({ transactionId })
  }

  public async saveTransactionComment(
    transactionId: string,
    comment: Comment
  ): Promise<Comment> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const commentToSave: Comment = {
      ...comment,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await collection.updateOne(
      {
        transactionId,
      },
      {
        $push: { comments: commentToSave },
      }
    )
    return commentToSave
  }

  public async deleteTransactionComment(
    transactionId: string,
    commentId: string
  ) {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      {
        transactionId,
      },
      {
        $pull: { comments: { id: commentId } },
      }
    )
  }

  public async getTransactionCaseManagementById(
    transactionId: string
  ): Promise<TransactionCaseManagement | null> {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    return collection.findOne<TransactionCaseManagement>({ transactionId })
  }

  /* DynamoDB operations */

  public async saveTransaction(
    transaction: Transaction,
    rulesResult: {
      executedRules?: ExecutedRulesResult[]
      failedRules?: FailedRulesResult[]
    } = {}
  ): Promise<Transaction> {
    transaction.transactionId =
      transaction.transactionId ||
      `${getTimstampBasedIDPrefix(transaction.timestamp)}-${uuidv4()}`
    transaction.timestamp = transaction.timestamp || Date.now()

    const senderKeys = getSenderKeys(this.tenantId, transaction)
    const receiverKeys = getReceiverKeys(this.tenantId, transaction)
    const senderKeysOfTransactionType =
      transaction.type === undefined
        ? undefined
        : getSenderKeys(this.tenantId, transaction, transaction.type)
    const receiverKeysOfTransactionType =
      transaction.type === undefined
        ? undefined
        : getReceiverKeys(this.tenantId, transaction, transaction.type)

    // Important: Added/Deleted keys here should be reflected in nuke-tenant-data.ts as well
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [TarponStackConstants.DYNAMODB_TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  ...DynamoDbKeys.TRANSACTION(
                    this.tenantId,
                    transaction.transactionId
                  ),
                  ...transaction,
                  ...rulesResult,
                },
              },
            },
            senderKeys &&
              receiverKeys && {
                PutRequest: {
                  Item: {
                    ...senderKeys,
                    transactionId: transaction.transactionId,
                    receiverKeyId: receiverKeys.PartitionKeyID,
                  },
                },
              },
            senderKeys &&
              receiverKeys && {
                PutRequest: {
                  Item: {
                    ...receiverKeys,
                    transactionId: transaction.transactionId,
                    senderKeyId: senderKeys.PartitionKeyID,
                  },
                },
              },
            senderKeysOfTransactionType && {
              PutRequest: {
                Item: {
                  ...senderKeysOfTransactionType,
                  transactionId: transaction.transactionId,
                  receiverKeyId: receiverKeysOfTransactionType?.PartitionKeyID,
                },
              },
            },
            receiverKeysOfTransactionType && {
              PutRequest: {
                Item: {
                  ...receiverKeysOfTransactionType,
                  transactionId: transaction.transactionId,
                  senderKeyId: senderKeysOfTransactionType?.PartitionKeyID,
                },
              },
            },
            senderKeys &&
              transaction?.deviceData?.ipAddress && {
                PutRequest: {
                  Item: {
                    ...DynamoDbKeys.IP_ADDRESS_TRANSACTION(
                      this.tenantId,
                      transaction.deviceData.ipAddress,
                      transaction.timestamp
                    ),
                    transactionId: transaction.transactionId,
                    senderKeyId: senderKeys.PartitionKeyID,
                  },
                },
              },
          ].filter(Boolean) as WriteRequest[],
        },
        ReturnConsumedCapacity: 'TOTAL',
      }
    await this.dynamoDb.batchWrite(batchWriteItemParams).promise()
    return transaction
  }

  public async getTransactionById(
    transactionId: string
  ): Promise<TransactionWithRulesResult | null> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()

    if (!result.Item) {
      return null
    }

    const transaction = {
      ...result.Item,
    }
    delete transaction.PartitionKeyID
    delete transaction.SortKeyID
    return transaction as TransactionWithRulesResult
  }

  public async getTransactionsByIds(
    transactionIds: string[]
  ): Promise<Transaction[]> {
    const transactions = []
    for (const transactionIdsChunk of chunk(transactionIds, 100)) {
      transactions.push(
        ...(await this.getTransactionsByIdsChunk(transactionIdsChunk))
      )
    }
    return transactions
  }

  private async getTransactionsByIdsChunk(
    transactionIds: string[]
  ): Promise<Transaction[]> {
    if (transactionIds.length > 100) {
      // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html
      throw new Error('Can only get at most 100 transactions at a time!')
    }
    if (transactionIds.length === 0) {
      return []
    }

    const transactionAttributeNames = Transaction.getAttributeTypeMap().map(
      (attribute) => attribute.name
    )
    const batchGetItemInput: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
      RequestItems: {
        [TarponStackConstants.DYNAMODB_TABLE_NAME]: {
          Keys: Array.from(new Set(transactionIds)).map((transactionId) =>
            DynamoDbKeys.TRANSACTION(this.tenantId, transactionId)
          ),
          ProjectionExpression: transactionAttributeNames
            .map((name) => `#${name}`)
            .join(', '),
          ExpressionAttributeNames: Object.fromEntries(
            transactionAttributeNames.map((name) => [`#${name}`, name])
          ),
        },
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.batchGet(batchGetItemInput).promise()
    return (
      (result.Responses?.[
        TarponStackConstants.DYNAMODB_TABLE_NAME
      ] as Transaction[]) || []
    )
  }

  public async hasAnySendingTransaction(
    userId: string,
    transactionType?: string
  ): Promise<boolean> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER_TRANSACTION(
          this.tenantId,
          userId,
          'sending',
          transactionType
        ).PartitionKeyID,
      },
      Limit: 1,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await paginateQuery(this.dynamoDb, queryInput)
    return !!result.Count
  }

  public async getLastNUserSendingThinTransactions(
    userId: string,
    n: number,
    transactionType?: string
  ): Promise<Array<ThinTransaction>> {
    return this.getLastNThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'sending',
        transactionType
      ).PartitionKeyID,
      n
    )
  }

  public getLastNUserReceivingThinTransactions(
    userId: string,
    n: number,
    transactionType?: string
  ): Promise<Array<ThinTransaction>> {
    return this.getLastNThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'receiving',
        transactionType
      ).PartitionKeyID,
      n
    )
  }

  private async getLastNThinTransactions(
    partitionKeyId: string,
    n: number
  ): Promise<Array<ThinTransaction>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
      },
      Limit: n,
      ScanIndexForward: false,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await paginateQuery(this.dynamoDb, queryInput)
    return (
      result.Items?.map((item) => ({
        transactionId: item.transactionId,
        timestamp: parseInt(item.SortKeyID),
        senderKeyId: item.senderKeyId,
        receiverKeyId: item.receiverKeyId,
      })) || []
    )
  }

  public async getUserSendingThinTransactions(
    userId: string,
    timeRange: TimeRange,
    transactionType?: string
  ): Promise<Array<ThinTransaction>> {
    return this.getThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'sending',
        transactionType
      ).PartitionKeyID,
      timeRange
    )
  }

  public async getUserReceivingThinTransactions(
    userId: string,
    timeRange: TimeRange,
    transactionType?: string
  ): Promise<Array<ThinTransaction>> {
    return this.getThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'receiving',
        transactionType
      ).PartitionKeyID,
      timeRange
    )
  }

  public async getUserSendingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    transactionType?: string
  ): Promise<QueryCountResult> {
    return this.getUserThinTransactionsCount(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'sending',
        transactionType
      ).PartitionKeyID,
      timeRange
    )
  }

  public async getUserReceivingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    transactionType?: string
  ): Promise<QueryCountResult> {
    return this.getUserThinTransactionsCount(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'receiving',
        transactionType
      ).PartitionKeyID,
      timeRange
    )
  }

  public async getNonUserSendingThinTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    transactionType?: string
  ): Promise<Array<ThinTransaction>> {
    return this.getThinTransactions(
      DynamoDbKeys.NON_USER_TRANSACTION(
        this.tenantId,
        paymentDetails,
        'sending',
        transactionType
      ).PartitionKeyID,
      timeRange
    )
  }

  public async getNonUserReceivingThinTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    transactionType?: string
  ): Promise<Array<ThinTransaction>> {
    return this.getThinTransactions(
      DynamoDbKeys.NON_USER_TRANSACTION(
        this.tenantId,
        paymentDetails,
        'receiving',
        transactionType
      ).PartitionKeyID,
      timeRange
    )
  }

  public async getIpAddressThinTransactions(
    ipAddress: string,
    timeRange: TimeRange
  ): Promise<Array<ThinTransaction>> {
    return this.getThinTransactions(
      DynamoDbKeys.IP_ADDRESS_TRANSACTION(this.tenantId, ipAddress)
        .PartitionKeyID,
      timeRange
    )
  }

  private getTransactionsQuery(
    partitionKeyId: string,
    timeRange: TimeRange
  ): AWS.DynamoDB.DocumentClient.QueryInput {
    return {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression:
        'PartitionKeyID = :pk AND SortKeyID BETWEEN :skfrom AND :skto',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ':skfrom': `${timeRange.afterTimestamp}`,
        ':skto': `${timeRange.beforeTimestamp}`,
      },
      ScanIndexForward: false,
      ReturnConsumedCapacity: 'TOTAL',
    }
  }

  private async getThinTransactions(
    partitionKeyId: string,
    timeRange: TimeRange
  ): Promise<Array<ThinTransaction>> {
    const result = await paginateQuery(
      this.dynamoDb,
      this.getTransactionsQuery(partitionKeyId, timeRange)
    )
    return (
      result.Items?.map((item) => ({
        transactionId: item.transactionId,
        timestamp: parseInt(item.SortKeyID),
        senderKeyId: item.senderKeyId,
        receiverKeyId: item.receiverKeyId,
      })) || []
    )
  }

  private async getUserThinTransactionsCount(
    partitionKeyId: string,
    timeRange: TimeRange
  ): Promise<QueryCountResult> {
    const result = await paginateQuery(this.dynamoDb, {
      ...this.getTransactionsQuery(partitionKeyId, timeRange),
      Select: 'COUNT',
    })
    return {
      count: result.Count as number,
      scannedCount: result.ScannedCount as number,
    }
  }
}

export type ThinTransaction = {
  transactionId: string
  timestamp: number
  senderKeyId: string | undefined
  receiverKeyId: string | undefined
}
