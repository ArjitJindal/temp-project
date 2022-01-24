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

  async saveTransaction(transaction: Transaction): Promise<string> {
    const transactionID = transaction.id || uuidv4()
    const putItemParams: AWS.DynamoDB.DocumentClient.PutItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Item: {
        PartitionKeyID: `${this.tenantId}#transaction`,
        SortKeyID: `${transaction.userId}#${transaction.timestamp}#${transactionID}}`,
        id: transactionID,
        ...transaction,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }

    await this.dynamoDb.put(putItemParams).promise()
    return transactionID
  }

  async hasAnyTransaction(userId: string): Promise<boolean> {
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
