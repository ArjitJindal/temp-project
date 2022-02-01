import { TarponStackConstants } from '../../../lib/constants'
import { PaymentDirection } from '../../@types/tranasction/payment-direction'
import { DynamoDbKeys } from '../../core/dynamodb/dynamodb-keys'

type UserAggregationAttributes = {
  sendingCountries: Set<string>
  receivingCountries: Set<string>
  sendingCurrencies: Set<string>
  receivingCurrencies: Set<string>
  sendingTransactionsCount: number
  receivingTransactionsCount: number
}

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
    const attribute: keyof UserAggregationAttributes = `${direction}Countries`
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      UpdateExpression: `ADD ${attribute} :countries`,
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
  ): Promise<
    Pick<UserAggregationAttributes, 'receivingCountries' | 'sendingCountries'>
  > {
    const attributes: Array<keyof UserAggregationAttributes> = [
      'receivingCountries',
      'sendingCountries',
    ]
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      ProjectionExpression: attributes.join(','),
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
    const attribute: keyof UserAggregationAttributes = `${direction}Currencies`
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      UpdateExpression: `ADD ${attribute} :currencies`,
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
  ): Promise<
    Pick<UserAggregationAttributes, 'receivingCurrencies' | 'sendingCurrencies'>
  > {
    const attributes: Array<keyof UserAggregationAttributes> = [
      'receivingCurrencies',
      'sendingCurrencies',
    ]
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      ProjectionExpression: attributes.join(','),
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
    const attribute: keyof UserAggregationAttributes = `${direction}TransactionsCount`
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      UpdateExpression: `SET ${attribute} = if_not_exists(${attribute}, :start) + :inc`,
      ExpressionAttributeValues: {
        ':start': 0,
        ':inc': 1,
      },
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.update(updateItemInput).promise()
  }

  public async getUserTransactionsCount(
    userId: string
  ): Promise<
    Pick<
      UserAggregationAttributes,
      'receivingTransactionsCount' | 'sendingTransactionsCount'
    >
  > {
    const attributes: Array<keyof UserAggregationAttributes> = [
      'receivingTransactionsCount',
      'sendingTransactionsCount',
    ]
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      ProjectionExpression: attributes.join(','),
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return {
      receivingTransactionsCount: result.Item?.receivingTransactionsCount || 0,
      sendingTransactionsCount: result.Item?.sendingTransactionsCount || 0,
    }
  }
}
