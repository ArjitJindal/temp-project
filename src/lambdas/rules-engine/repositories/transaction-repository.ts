import { v4 as uuidv4 } from 'uuid'
import { MongoClient } from 'mongodb'
import { TarponStackConstants } from '../../../../lib/constants'
import { Transaction } from '../../../@types/openapi-public/Transaction'
import { PaymentDetails } from '../../../@types/tranasction/payment-type'
import { DynamoDbKeys } from '../../../core/dynamodb/dynamodb-keys'
import { getTimstampBasedIDPrefix } from '../../../utils/timestampUtils'
import { ExecutedRulesResult } from '../../../@types/openapi-public/ExecutedRulesResult'
import { FailedRulesResult } from '../../../@types/openapi-public/FailedRulesResult'
import { TransactionWithRulesResult } from '../../../@types/openapi-public/TransactionWithRulesResult'
import { TRANSACIONS_COLLECTION } from '../../../utils/docDBUtils'

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

  public async getTransactions(
    // TOOD: Add filtering and sorting
    pagination: { limit: number; skip: number; beforeTimestamp: number }
  ): Promise<{ total: number; data: TransactionWithRulesResult[] }> {
    const db = this.mongoDb.db(TarponStackConstants.DOCUMENT_DB_DATABASE_NAME)
    const collection = db.collection<TransactionWithRulesResult>(
      TRANSACIONS_COLLECTION(this.tenantId)
    )
    const query = {
      timestamp: { $lte: pagination.beforeTimestamp },
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

  public async saveTransaction(
    transaction: Transaction,
    rulesResult: {
      executedRules?: ExecutedRulesResult[]
      failedRules?: FailedRulesResult[]
    } = {}
  ): Promise<string> {
    const transactionId =
      transaction.transactionId ||
      `${getTimstampBasedIDPrefix(transaction.timestamp)}-${uuidv4()}`

    const senderKeys = DynamoDbKeys.ALL_TRANSACTION(
      this.tenantId,
      transaction.senderUserId,
      transaction.senderPaymentDetails,
      'sending',
      transaction.timestamp
    )
    const receiverKeys = DynamoDbKeys.ALL_TRANSACTION(
      this.tenantId,
      transaction.receiverUserId,
      transaction.receiverPaymentDetails,
      'receiving',
      transaction.timestamp
    )
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [TarponStackConstants.DYNAMODB_TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  ...DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
                  ...transaction,
                  ...rulesResult,
                },
              },
            },
            {
              PutRequest: {
                Item: {
                  ...senderKeys,
                  transactionId,
                  receiverKeyId: receiverKeys.PartitionKeyID,
                },
              },
            },
            {
              PutRequest: {
                Item: {
                  ...receiverKeys,
                  transactionId,
                  senderKeyId: senderKeys.PartitionKeyID,
                },
              },
            },
          ],
        },
        ReturnConsumedCapacity: 'TOTAL',
      }
    await this.dynamoDb.batchWrite(batchWriteItemParams).promise()
    return transactionId
  }

  public async getTransactionById(
    transactionId: string
  ): Promise<TransactionWithRulesResult> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
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
          Keys: transactionIds.map((transactionId) =>
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

  public async hasAnySendingTransaction(userId: string): Promise<boolean> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER_TRANSACTION(this.tenantId, userId, 'sending')
          .PartitionKeyID,
      },
      Limit: 1,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.query(queryInput).promise()
    return !!result.Count
  }

  public async getLastNUserSendingThinTransactions(
    userId: string,
    n: number
  ): Promise<Array<ThinTransaction>> {
    return this.getLastNThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(this.tenantId, userId, 'sending')
        .PartitionKeyID,
      n
    )
  }

  public getLastNUserReceivingThinTransactions(
    userId: string,
    n: number
  ): Promise<Array<ThinTransaction>> {
    return this.getLastNThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(this.tenantId, userId, 'receiving')
        .PartitionKeyID,
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
    const result = await this.dynamoDb.query(queryInput).promise()
    return (
      result.Items?.map((item) => ({
        transactionId: item.transactionId,
        timestamp: item.SortKeyID,
        senderUserId: item.senderUserId,
        receiverUserId: item.receiverUserId,
      })) || []
    )
  }

  public async getAfterTimeUserSendingThinTransactions(
    userId: string,
    afterTimestamp: number
  ): Promise<Array<ThinTransaction>> {
    return this.getAfterTimeUserThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(this.tenantId, userId, 'sending')
        .PartitionKeyID,
      afterTimestamp
    )
  }

  public async getAfterTimeUserReceivingThinTransactions(
    userId: string,
    afterTimestamp: number
  ): Promise<Array<ThinTransaction>> {
    return this.getAfterTimeUserThinTransactions(
      DynamoDbKeys.USER_TRANSACTION(this.tenantId, userId, 'receiving')
        .PartitionKeyID,
      afterTimestamp
    )
  }

  public async getAfterTimeNonUserSendingThinTransactions(
    paymentDetails: PaymentDetails,
    afterTimestamp: number
  ): Promise<Array<ThinTransaction>> {
    return this.getAfterTimeUserThinTransactions(
      DynamoDbKeys.NON_USER_TRANSACTION(
        this.tenantId,
        paymentDetails,
        'sending'
      ).PartitionKeyID,
      afterTimestamp
    )
  }

  public async getAfterTimeNonUserReceivingThinTransactions(
    paymentDetails: PaymentDetails,
    afterTimestamp: number
  ): Promise<Array<ThinTransaction>> {
    return this.getAfterTimeUserThinTransactions(
      DynamoDbKeys.NON_USER_TRANSACTION(
        this.tenantId,
        paymentDetails,
        'receiving'
      ).PartitionKeyID,
      afterTimestamp
    )
  }

  private async getAfterTimeUserThinTransactions(
    partitionKeyId: string,
    afterTimestamp: number
  ): Promise<Array<ThinTransaction>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk AND SortKeyID > :sk',
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ':sk': `${afterTimestamp}`,
      },
      ScanIndexForward: false,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.query(queryInput).promise()
    return (
      result.Items?.map((item) => ({
        transactionId: item.transactionId,
        timestamp: item.SortKeyID,
        senderKeyId: item.senderKeyId,
        receiverKeyId: item.receiverKeyId,
      })) || []
    )
  }
}

export type ThinTransaction = {
  transactionId: string
  timestamp: number
  senderKeyId?: string
  receiverKeyId?: string
}
