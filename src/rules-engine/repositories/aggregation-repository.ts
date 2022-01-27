import { TarponStackConstants } from '../../../lib/constants'

type PaymentDirection = 'receiving' | 'sending'

export class AggregationRepository {
  dynamoDb: AWS.DynamoDB.DocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: AWS.DynamoDB.DocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  /**
   *  User transaction countries
   */

  public async addUserTransactionCountry(
    userId: string,
    country: string,
    direction: PaymentDirection
  ) {
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      UpdateExpression: `ADD ${direction}Countries :countries`,
      ExpressionAttributeValues: {
        ':countries': this.dynamoDb.createSet([country]),
      },
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.update(updateItemInput).promise()
  }

  public async getUserTransactionCountries(
    userId: string
  ): Promise<UserTransactionCountries> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      AttributesToGet: ['receivingCountries', 'sendingCountries'],
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return {
      receivingCountries: new Set(
        result.Item?.receivingCountries?.values || []
      ),
      sendingCountries: new Set(result.Item?.sendingCountries?.values || []),
    }
  }

  /**
   *  User transaction currencies
   */

  public async addUserTransactionCurrency(
    userId: string,
    currency: string,
    direction: PaymentDirection
  ) {
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      UpdateExpression: `ADD ${direction}Currencies :currencies`,
      ExpressionAttributeValues: {
        ':currencies': this.dynamoDb.createSet([currency]),
      },
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.update(updateItemInput).promise()
  }

  public async getUserTransactionCurrencies(
    userId: string
  ): Promise<UserTransactionCurrencies> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      AttributesToGet: ['receivingCurrencies', 'sendingCurrencies'],
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return {
      receivingCurrencies: new Set(
        result.Item?.receivingCurrencies?.values || []
      ),
      sendingCurrencies: new Set(result.Item?.sendingCurrencies?.values || []),
    }
  }

  /**
   *  User transactions count
   */

  public async addUserTransactionsCount(
    userId: string,
    direction: PaymentDirection
  ) {
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      UpdateExpression: `SET ${direction}TransactionsCount = if_not_exists(${direction}TransactionsCount, :start) + :inc`,
      ExpressionAttributeValues: {
        ':start': 0,
        ':inc': 1,
      },
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.update(updateItemInput).promise()
  }

  public async getUserTransactionsCount(userId: string) {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      AttributesToGet: [
        'receivingTransactionsCount',
        'sendingTransactionsCount',
      ],
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return {
      receivingTransactionsCount: result.Item?.receivingTransactionsCount || 0,
      sendingTransactionsCount: result.Item?.sendingTransactionsCount || 0,
    }
  }
}

export type UserTransactionCountries = {
  receivingCountries: Set<string>
  sendingCountries: Set<string>
}

export type UserTransactionCurrencies = {
  receivingCurrencies: Set<string>
  sendingCurrencies: Set<string>
}

export type UserTransactionsCount = {
  receivingCount: number
  sendingCount: number
}
