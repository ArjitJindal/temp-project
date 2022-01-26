import { Transaction } from '../../@types/transaction/transaction'
import { v4 as uuidv4 } from 'uuid'
import { TarponStackConstants } from '../../../lib/constants'

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
                  PartitionKeyID: `${this.tenantId}#transaction`,
                  SortKeyID: transactionId,
                  transactionId,
                  ...transaction,
                },
              },
            },
            {
              PutRequest: {
                Item: {
                  PartitionKeyID: `${this.tenantId}#transaction`,
                  SortKeyID: `${transaction.userId}#${transaction.timestamp}#${transactionId}}`,
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
      Key: {
        PartitionKeyID: `${this.tenantId}#transaction`,
        SortKeyID: transactionId,
      },
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
      KeyConditionExpression:
        'PartitionKeyID = :pk AND begins_with(SortKeyID, :userId)',
      ExpressionAttributeValues: {
        ':pk': `${this.tenantId}#transaction`,
        ':userId': userId,
      },
      Limit: 1,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.query(queryInput).promise()
    return !!result.Count
  }
}
