import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { TarponStackConstants } from '../../../lib/constants'
import { Transaction } from '../../@types/openapi/transaction'
import { DynamoDbKeys } from '../../core/dynamodb/dynamodb-keys'

export class TransactionRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: AWS.DynamoDB.DocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  public async saveTransaction(transaction: Transaction): Promise<string> {
    const transactionId = transaction.transactionId || uuidv4()
    const writeRequests: WriteRequest[] = [
      {
        PutRequest: {
          Item: {
            ...DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
            ...transaction,
          } as any,
        },
      },
    ]
    if (transaction.senderUserId) {
      writeRequests.push({
        PutRequest: {
          Item: {
            ...DynamoDbKeys.USER_SENDING_TRANSACTION(
              this.tenantId,
              transaction.senderUserId,
              transaction.timestamp
            ),
            transactionId,
          } as any,
        },
      })
    }
    if (transaction.receiverUserId) {
      writeRequests.push({
        PutRequest: {
          Item: {
            ...DynamoDbKeys.USER_RECEIVING_TRANSACTION(
              this.tenantId,
              transaction.receiverUserId,
              transaction.timestamp
            ),
            transactionId,
          } as any,
        },
      })
    }
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [TarponStackConstants.DYNAMODB_TABLE_NAME]: writeRequests,
        },
        ReturnConsumedCapacity: 'TOTAL',
      }
    await this.dynamoDb.batchWrite(batchWriteItemParams).promise()
    return transactionId
  }

  public async getTransaction(transactionId: string): Promise<Transaction> {
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
    return transaction as Transaction
  }

  public async getTransactions(
    transactionIds: string[]
  ): Promise<Transaction[]> {
    if (transactionIds.length > 100) {
      // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html
      throw new Error('Can only get at most 100 transactions at a time!')
    }
    const batchGetItemInput: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
      RequestItems: {
        [TarponStackConstants.DYNAMODB_TABLE_NAME]: {
          Keys: transactionIds.map((transactionId) =>
            DynamoDbKeys.TRANSACTION(this.tenantId, transactionId)
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
        ':pk': DynamoDbKeys.USER_SENDING_TRANSACTION(this.tenantId, userId)
          .PartitionKeyID,
      },
      Limit: 1,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.query(queryInput).promise()
    return !!result.Count
  }

  public async getLastNSendingThinTransactions(
    userId: string,
    n: number
  ): Promise<Array<ThinTransaction>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER_SENDING_TRANSACTION(this.tenantId, userId)
          .PartitionKeyID,
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
      })) || []
    )
  }

  public async getLastNReceivingThinTransactions(
    userId: string,
    n: number
  ): Promise<Array<ThinTransaction>> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER_RECEIVING_TRANSACTION(this.tenantId, userId)
          .PartitionKeyID,
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
      })) || []
    )
  }
}

type ThinTransaction = {
  transactionId: string
  timestamp: number
}
