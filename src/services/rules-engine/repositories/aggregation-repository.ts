import { StackConstants } from '@cdk/constants'
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import AWS from 'aws-sdk'
import dayjs from '@/utils/dayjs'
import { DynamoDbKeys, TimeGranularity } from '@/core/dynamodb/dynamodb-keys'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'

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
  dynamoDb: DynamoDBDocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      UpdateExpression: `ADD ${attribute} :countries`,
      ExpressionAttributeValues: {
        ':countries': new Set<string>([country]),
      },
      ReturnValues: 'UPDATED_NEW',
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      ProjectionExpression: attributes.join(','),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return {
      receivingFromCountries: result.Item?.receivingFromCountries || new Set(),
      receivingToCountries: result.Item?.receivingToCountries || new Set(),
      sendingFromCountries: result.Item?.sendingFromCountries || new Set(),
      sendingToCountries: result.Item?.sendingToCountries || new Set(),
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      UpdateExpression: `ADD ${attribute} :currencies`,
      ExpressionAttributeValues: {
        ':currencies': new Set<string>([currency]),
      },
      ReturnValues: 'UPDATED_NEW',
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      ProjectionExpression: attributes.join(','),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return {
      receivingCurrencies: result.Item?.receivingCurrencies || new Set(),
      sendingCurrencies: result.Item?.sendingCurrencies || new Set(),
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      UpdateExpression: `SET ${attribute} = if_not_exists(${attribute}, :start) + :inc`,
      ExpressionAttributeValues: {
        ':start': 0,
        ':inc': 1,
      },
      ReturnValues: 'UPDATED_NEW',
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_AGGREGATION(this.tenantId, userId),
      ProjectionExpression: attributes.join(','),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
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
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
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
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_TIME_AGGREGATION(
        this.tenantId,
        userId,
        this.getTransactionsVolumeQuantileTimeLabel(timestamp, timeGranularity)
      ),
      ProjectionExpression: attributes.join(','),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
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
        return dayjs(timestamp).format('YYYY-MM-DD')
      case 'month':
        return dayjs(timestamp).format('YYYY-MM')
      case 'year':
        return dayjs(timestamp).format('YYYY')
    }
  }
}
