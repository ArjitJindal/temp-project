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
      ProjectionExpression: 'receivingCountries, sendingCountries',
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
      ProjectionExpression: 'receivingCurrencies, sendingCurrencies',
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
      ProjectionExpression:
        'receivingTransactionsCount, sendingTransactionsCount',
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return {
      receivingTransactionsCount: result.Item?.receivingTransactionsCount || 0,
      sendingTransactionsCount: result.Item?.sendingTransactionsCount || 0,
    }
  }

  /**
   *  User last transaction time
   */

  public async setUserLastTransactionTime(userId: string, time: number) {
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      UpdateExpression: `SET lastTransactionTime = :lastTransactionTime`,
      ConditionExpression:
        'attribute_not_exists(lastTransactionTime) OR (lastTransactionTime < :lastTransactionTime)',
      ExpressionAttributeValues: {
        ':lastTransactionTime': time,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }
    try {
      await this.dynamoDb.update(updateItemInput).promise()
    } catch (e: any) {
      if (e?.code === 'ConditionalCheckFailedException') {
        // Ignore
      }
    }
  }

  public async getUserLastTransactionTime(
    userId: string
  ): Promise<Date | undefined> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: {
        PartitionKeyID: `${this.tenantId}#aggregation`,
        SortKeyID: `user#${userId}`,
      },
      AttributesToGet: ['lastTransactionTime'],
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return result.Item?.lastTransactionTime
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
