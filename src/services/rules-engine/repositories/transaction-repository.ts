import { v4 as uuidv4 } from 'uuid'
import { AggregationCursor, Document, Filter, MongoClient } from 'mongodb'
import _, { chunk } from 'lodash'
import { TarponStackConstants } from '@cdk/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import { getReceiverKeys, getSenderKeys } from '../utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getTimstampBasedIDPrefix } from '@/utils/timestampUtils'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { TRANSACTIONS_COLLECTION, USERS_COLLECTION } from '@/utils/mongoDBUtils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { TransactionStatusChange } from '@/@types/openapi-internal/TransactionStatusChange'
import { paginateQuery } from '@/utils/dynamodb'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { HitRulesResult } from '@/@types/openapi-public/HitRulesResult'

type QueryCountResult = { count: number; scannedCount: number }
type TimeRange = {
  beforeTimestamp: number
  afterTimestamp: number
}
export type ThinTransaction = {
  transactionId: string
  timestamp: number
  transactionState?: TransactionState
  senderKeyId?: string
  receiverKeyId?: string
}

type ThinTransactionsFilterOptions = {
  transactionType?: string
  transactionState?: TransactionState
  senderKeyId?: string
  receiverKeyId?: string
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
    if (params.transactionType != null) {
      query['type'] = { $regex: params.transactionType }
    }
    if (params.filterOutStatus != null) {
      query['status'] = { $ne: params.filterOutStatus }
    }
    if (params.filterOriginUserId != null) {
      query['originUserId'] = { $eq: params.filterOriginUserId }
    }
    if (params.filterDestinationUserId != null) {
      query['destinationUserId'] = { $eq: params.filterDestinationUserId }
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
          ruleId: { $in: params.filterRulesHit },
        },
      })
    }
    if (executedRulesFilters.length > 0) {
      query['executedRules'] = {
        $all: executedRulesFilters,
      }
    }

    if (params.filterOriginCurrencies != null) {
      query['originAmountDetails.transactionCurrency'] = {
        $in: params.filterOriginCurrencies,
      }
    }
    if (params.filterDestinationCurrencies != null) {
      query['destinationAmountDetails.transactionCurrency'] = {
        $in: params.filterDestinationCurrencies,
      }
    }

    return query
  }

  public async getTransactionsCursor(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<AggregationCursor<TransactionCaseManagement>> {
    const query = this.getTransactionsMongoQuery(params)
    return this.getDenormalizedTransactions(query, params)
  }

  private getDenormalizedTransactions(
    query: Filter<TransactionCaseManagement>,
    params?: DefaultApiGetTransactionsListRequest
  ) {
    const db = this.mongoDb.db(TarponStackConstants.MONGO_DB_DATABASE_NAME)
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'timestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1
    const pipeline: Document[] = [
      { $match: query },
      {
        $lookup: {
          from: USERS_COLLECTION(this.tenantId),
          localField: 'originUserId',
          foreignField: 'userId',
          as: 'originUser',
        },
      },
      {
        $lookup: {
          from: USERS_COLLECTION(this.tenantId),
          localField: 'destinationUserId',
          foreignField: 'userId',
          as: 'destinationUser',
        },
      },
      {
        $set: {
          originUser: { $first: '$originUser' },
          destinationUser: { $first: '$destinationUser' },
        },
      },
      { $sort: { [sortField]: sortOrder } },
    ]
    if (sortField === 'ruleHitCount') {
      pipeline.push(
        {
          $addFields: {
            Hit: { $size: '$hitRules' },
          },
        },
        { $sort: { Hit: sortOrder } }
      )
    }
    if (params?.skip) {
      pipeline.push({ $skip: params.skip })
    }
    if (params?.limit) {
      pipeline.push({ $limit: params.limit })
    }
    return collection.aggregate<TransactionCaseManagement>(pipeline)
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
    return { total, data: await cursor.toArray() }
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
    return await this.getDenormalizedTransactions({
      transactionId,
    }).next()
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
      hitRules?: HitRulesResult[]
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
            senderKeys && {
              PutRequest: {
                Item: {
                  ...senderKeys,
                  transactionId: transaction.transactionId,
                  receiverKeyId: receiverKeys?.PartitionKeyID,
                  transactionState: transaction.transactionState,
                },
              },
            },
            receiverKeys && {
              PutRequest: {
                Item: {
                  ...receiverKeys,
                  transactionId: transaction.transactionId,
                  senderKeyId: senderKeys?.PartitionKeyID,
                  transactionState: transaction.transactionState,
                },
              },
            },
            senderKeysOfTransactionType && {
              PutRequest: {
                Item: {
                  ...senderKeysOfTransactionType,
                  transactionId: transaction.transactionId,
                  receiverKeyId: receiverKeysOfTransactionType?.PartitionKeyID,
                  transactionState: transaction.transactionState,
                },
              },
            },
            receiverKeysOfTransactionType && {
              PutRequest: {
                Item: {
                  ...receiverKeysOfTransactionType,
                  transactionId: transaction.transactionId,
                  senderKeyId: senderKeysOfTransactionType?.PartitionKeyID,
                  transactionState: transaction.transactionState,
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
                    transactionState: transaction.transactionState,
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
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<boolean> {
    const transactionFilterQuery =
      this.getThinTransactionFilterQueryInput(filterOptions)
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER_TRANSACTION(
          this.tenantId,
          userId,
          'sending',
          filterOptions?.transactionType
        ).PartitionKeyID,
        ...transactionFilterQuery.ExpressionAttributeValues,
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
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    return this.getLastNThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'sending',
        filterOptions?.transactionType
      ).PartitionKeyID,
      n,
      filterOptions
    )
  }

  public getLastNUserReceivingThinTransactions(
    userId: string,
    n: number,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    return this.getLastNThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'receiving',
        filterOptions?.transactionType
      ).PartitionKeyID,
      n,
      filterOptions
    )
  }

  private async getLastNThinTransactions(
    partitionKeyId: string,
    n: number,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    const transactionFilterQuery =
      this.getThinTransactionFilterQueryInput(filterOptions)
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ...transactionFilterQuery.ExpressionAttributeValues,
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

  public async getGenericUserSendingThinTransactions(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    return userId
      ? this.getUserSendingThinTransactions(userId, timeRange, filterOptions)
      : paymentDetails
      ? this.getNonUserSendingThinTransactions(
          paymentDetails,
          timeRange,
          filterOptions
        )
      : []
  }

  public async getGenericUserReceivingThinTransactions(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    return userId
      ? this.getUserReceivingThinTransactions(userId, timeRange, filterOptions)
      : paymentDetails
      ? this.getNonUserReceivingThinTransactions(
          paymentDetails,
          timeRange,
          filterOptions
        )
      : []
  }

  public async getUserSendingThinTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    return this.getThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'sending',
        filterOptions?.transactionType
      ).PartitionKeyID,
      timeRange,
      filterOptions
    )
  }

  public async getUserReceivingThinTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    return this.getThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'receiving',
        filterOptions?.transactionType
      ).PartitionKeyID,
      timeRange,
      filterOptions
    )
  }

  public async getGenericUserSendingTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ) {
    return userId
      ? (
          await this.getUserSendingTransactionsCount(
            userId,
            timeRange,
            filterOptions
          )
        ).count
      : paymentDetails
      ? (
          await this.getNonUserSendingTransactionsCount(
            paymentDetails,
            timeRange,
            filterOptions
          )
        ).count
      : 0
  }

  public async getGenericUserReceivingTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ) {
    return userId
      ? (
          await this.getUserReceivingTransactionsCount(
            userId,
            timeRange,
            filterOptions
          )
        ).count
      : paymentDetails
      ? (
          await this.getNonUserReceivingTransactionsCount(
            paymentDetails,
            timeRange,
            filterOptions
          )
        ).count
      : 0
  }

  public async getUserSendingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<QueryCountResult> {
    return this.getUserThinTransactionsCount(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'sending',
        filterOptions?.transactionType
      ).PartitionKeyID,
      timeRange,
      filterOptions
    )
  }

  public async getUserReceivingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<QueryCountResult> {
    return this.getUserThinTransactionsCount(
      DynamoDbKeys.USER_TRANSACTION(
        this.tenantId,
        userId,
        'receiving',
        filterOptions?.transactionType
      ).PartitionKeyID,
      timeRange,
      filterOptions
    )
  }

  public async getNonUserSendingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<QueryCountResult> {
    const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
      this.tenantId,
      paymentDetails,
      'sending',
      filterOptions?.transactionType
    )?.PartitionKeyID
    return partitionKeyId
      ? this.getUserThinTransactionsCount(
          partitionKeyId,
          timeRange,
          filterOptions
        )
      : { count: 0, scannedCount: 0 }
  }

  public async getNonUserReceivingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<QueryCountResult> {
    const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
      this.tenantId,
      paymentDetails,
      'receiving',
      filterOptions?.transactionType
    )?.PartitionKeyID
    return partitionKeyId
      ? this.getUserThinTransactionsCount(
          partitionKeyId,
          timeRange,
          filterOptions
        )
      : { count: 0, scannedCount: 0 }
  }

  public async getNonUserSendingThinTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
      this.tenantId,
      paymentDetails,
      'sending',
      filterOptions?.transactionType
    )?.PartitionKeyID
    return partitionKeyId
      ? this.getThinTransactions(partitionKeyId, timeRange, filterOptions)
      : []
  }

  public async getNonUserReceivingThinTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
      this.tenantId,
      paymentDetails,
      'receiving',
      filterOptions?.transactionType
    )?.PartitionKeyID
    return partitionKeyId
      ? this.getThinTransactions(partitionKeyId, timeRange, filterOptions)
      : []
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
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): AWS.DynamoDB.DocumentClient.QueryInput {
    const transactionFilterQuery =
      this.getThinTransactionFilterQueryInput(filterOptions)
    return {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression:
        'PartitionKeyID = :pk AND SortKeyID BETWEEN :skfrom AND :skto',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ':skfrom': `${timeRange.afterTimestamp}`,
        ':skto': `${timeRange.beforeTimestamp}`,
        ...transactionFilterQuery.ExpressionAttributeValues,
      },
      ScanIndexForward: false,
      ReturnConsumedCapacity: 'TOTAL',
    }
  }

  private async getThinTransactions(
    partitionKeyId: string,
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<Array<ThinTransaction>> {
    const result = await paginateQuery(
      this.dynamoDb,
      this.getTransactionsQuery(partitionKeyId, timeRange, filterOptions)
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
    timeRange: TimeRange,
    filterOptions?: ThinTransactionsFilterOptions
  ): Promise<QueryCountResult> {
    const result = await paginateQuery(this.dynamoDb, {
      ...this.getTransactionsQuery(partitionKeyId, timeRange, filterOptions),
      Select: 'COUNT',
    })
    return {
      count: result.Count as number,
      scannedCount: result.ScannedCount as number,
    }
  }

  private getThinTransactionFilterQueryInput(
    filterOptions: ThinTransactionsFilterOptions = {}
  ): Partial<AWS.DynamoDB.DocumentClient.QueryInput> {
    const filters = [
      filterOptions.transactionState && 'transactionState = :transactionState',
      filterOptions.receiverKeyId && 'receiverKeyId = :receiverKeyId',
      filterOptions.senderKeyId && 'senderKeyId = :senderKeyId',
    ].filter(Boolean)
    if (filters.length === 0) {
      return {}
    }
    return {
      FilterExpression: filters.join(' AND '),
      ExpressionAttributeValues: {
        ':transactionState': filterOptions.transactionState,
        ':senderKeyId': filterOptions.senderKeyId,
        ':receiverKeyId': filterOptions.receiverKeyId,
      },
    }
  }
}
