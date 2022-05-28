import { TarponStackConstants } from '@cdk/constants'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { DynamoDbKeys, TimeGranularity } from '@/core/dynamodb/dynamodb-keys'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'

dayjs.extend(utc)

type UserAggregationAttributes = {
  sendingFromCountries: Set<string>
  sendingToCountries: Set<string>
  receivingFromCountries: Set<string>
  receivingToCountries: Set<string>
  sendingCurrencies: Set<string>
  receivingCurrencies: Set<string>
  sendingTransactionsCount: number
  receivingTransactionsCount: number
}

type UserTimeAggregationAttributes = {
  sendingTransactionsVolume: TransactionAmountDetails[]
  receivingTransactionsVolume: TransactionAmountDetails[]
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
    direction: 'sendingFrom' | 'sendingTo' | 'receivingFrom' | 'receivingTo'
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
    Pick<
      UserAggregationAttributes,
      | 'receivingFromCountries'
      | 'receivingToCountries'
      | 'sendingFromCountries'
      | 'sendingToCountries'
    >
  > {
    const attributes: Array<keyof UserAggregationAttributes> = [
      'receivingFromCountries',
      'receivingToCountries',
      'sendingFromCountries',
      'sendingToCountries',
    ]
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      ProjectionExpression: attributes.join(','),
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return {
      receivingFromCountries: new Set(
        result.Item?.receivingFromCountries?.values || []
      ),
      receivingToCountries: new Set(
        result.Item?.receivingToCountries?.values || []
      ),
      sendingFromCountries: new Set(
        result.Item?.sendingFromCountries?.values || []
      ),
      sendingToCountries: new Set(
        result.Item?.sendingToCountries?.values || []
      ),
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

  /**
   *  User transactions volume quantils (DAILY, MONTHLY, YEARLY)
   */

  public async addUserTransactionsVolumeQuantiles(
    userId: string,
    direction: PaymentDirection,
    transactionAmountDetails: TransactionAmountDetails,
    timestamp: number,
    timeGranularity: TimeGranularity
  ) {
    const attribute: keyof UserTimeAggregationAttributes = `${direction}TransactionsVolume`
    const currentTransactionsVolume: TransactionAmountDetails = (
      await this.getUserTransactionsVolumeQuantile(
        userId,
        timestamp,
        timeGranularity
      )
    )?.[attribute] || {
      transactionAmount: 0,
      transactionCurrency: transactionAmountDetails.transactionCurrency,
    }
    const targetAmount = await getTargetCurrencyAmount(
      transactionAmountDetails,
      currentTransactionsVolume.transactionCurrency
    )
    const totalTransactionAmount: TransactionAmountDetails = {
      transactionAmount:
        targetAmount.transactionAmount +
        currentTransactionsVolume.transactionAmount,
      transactionCurrency: currentTransactionsVolume.transactionCurrency,
    }

    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_TIME_AGGREGATION(
        this.tenantId,
        userId,
        this.getTransactionsVolumeQuantileTimeLabel(timestamp, timeGranularity)
      ),
      UpdateExpression: `SET ${attribute} = :amount`,
      ExpressionAttributeValues: {
        ':amount': totalTransactionAmount,
      },
      ReturnValues: 'UPDATED_NEW',
      ReturnConsumedCapacity: 'TOTAL',
    }
    await this.dynamoDb.update(updateItemInput).promise()
  }

  public async getUserTransactionsVolumeQuantile(
    userId: string,
    timestamp: number,
    timeGranularity: TimeGranularity
  ): Promise<{
    sendingTransactionsVolume: TransactionAmountDetails | undefined
    receivingTransactionsVolume: TransactionAmountDetails | undefined
  }> {
    const attributes: Array<keyof UserTimeAggregationAttributes> = [
      'receivingTransactionsVolume',
      'sendingTransactionsVolume',
    ]
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_TIME_AGGREGATION(
        this.tenantId,
        userId,
        this.getTransactionsVolumeQuantileTimeLabel(timestamp, timeGranularity)
      ),
      ProjectionExpression: attributes.join(','),
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await this.dynamoDb.get(getItemInput).promise()
    return {
      sendingTransactionsVolume: result.Item?.sendingTransactionsVolume,
      receivingTransactionsVolume: result.Item?.receivingTransactionsVolume,
    }
  }

  // TODO: We use UTC time for getting the time label for now. We could use
  // the customer specified timezone if there's a need.
  private getTransactionsVolumeQuantileTimeLabel(
    timestamp: number,
    timeGranularity: TimeGranularity
  ): string {
    switch (timeGranularity) {
      case 'day':
        return dayjs.utc(timestamp).format('YYYY-MM-DD')
      case 'month':
        return dayjs.utc(timestamp).format('YYYY-MM')
      case 'year':
        return dayjs.utc(timestamp).format('YYYY')
    }
  }
}
