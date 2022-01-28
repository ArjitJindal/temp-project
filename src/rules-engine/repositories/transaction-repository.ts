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
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [TarponStackConstants.DYNAMODB_TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  ...DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
                  transactionId,
                  ...transaction,
                },
              },
            },
            {
              PutRequest: {
                Item: {
                  ...DynamoDbKeys.USER_TRANSACTION(
                    this.tenantId,
                    transaction.senderUserId,
                    transaction.timestamp
                  ),
                  transactionId,
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

  public async hasAnyTransaction(userId: string): Promise<boolean> {
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER_TRANSACTION(this.tenantId, userId)
          .PartitionKeyID,
      },
      Limit: 1,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.query(queryInput).promise()
    return !!result.Count
  }
}
