import { StackConstants } from '@lib/constants'
import {
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  QueryCommandInput,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb'
import _ from 'lodash'
import dayjs, { duration } from '@/utils/dayjs'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { PaymentDirection } from '@/@types/tranasction/payment-direction'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import {
  BatchWriteRequestInternal,
  batchWrite,
  dynamoDbQueryHelper,
  paginateQuery,
} from '@/utils/dynamodb'
import { PaymentMethod } from '@/@types/tranasction/payment-type'

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

export type UserTimeAggregationAttributes = {
  sendingTransactionsAmount: Map<
    PaymentMethod | 'ALL',
    TransactionAmountDetails
  >
  sendingTransactionsCount: Map<PaymentMethod | 'ALL', number>
  receivingTransactionsAmount: Map<
    PaymentMethod | 'ALL',
    TransactionAmountDetails
  >
  receivingTransactionsCount: Map<PaymentMethod | 'ALL', number>
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
    const updateItemInput: UpdateCommandInput = {
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
    const getItemInput: GetCommandInput = {
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
    const updateItemInput: UpdateCommandInput = {
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
    const getItemInput: GetCommandInput = {
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
    const updateItemInput: UpdateCommandInput = {
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
    const getItemInput: GetCommandInput = {
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
   *  User transactions stats
   */
  USER_TRANSACTION_STATS_VERSION = 1

  public async rebuildUserTransactionStatsTimeGroups(
    userId: string,
    aggregationData: {
      [timeLabel: string]: UserTimeAggregationAttributes
    }
  ): Promise<void> {
    const ttl =
      Math.floor(Date.now() / 1000) +
      duration(1, 'year').asSeconds() +
      duration(7, 'day').asSeconds()

    const writeRequests = Object.entries(aggregationData).map((entry) => {
      const keys = DynamoDbKeys.USER_TIME_AGGREGATION(
        this.tenantId,
        userId,
        entry[0],
        this.USER_TRANSACTION_STATS_VERSION
      )
      const data = _.mapValues(
        entry[1],
        (v) => v && Object.fromEntries(v.entries())
      )
      return {
        PutRequest: {
          Item: {
            ...keys,
            ...{
              ...data,
              ttl,
            },
          },
        },
      }
    }) as BatchWriteRequestInternal[]

    await batchWrite(
      this.dynamoDb,
      writeRequests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
  }

  public async addUserTransactionStatsTimeGroup(
    userId: string,
    direction: 'origin' | 'destination',
    transactionAmountDetails: TransactionAmountDetails,
    paymentMethod: PaymentMethod | undefined,
    timestamp: number,
    timeGranularity: 'day' | 'week' | 'month' | 'year'
  ): Promise<void> {
    const {
      sendingTransactionsAmount,
      sendingTransactionsCount,
      receivingTransactionsAmount,
      receivingTransactionsCount,
    } = await this.getUserTransactionStatsTimeGroup(
      userId,
      timestamp,
      timeGranularity
    )
    const transactionsAmount =
      direction === 'origin'
        ? sendingTransactionsAmount
        : receivingTransactionsAmount
    const transactionsCount =
      direction === 'origin'
        ? sendingTransactionsCount
        : receivingTransactionsCount

    // Transaction amount
    const defaultTransactionAmount = {
      transactionAmount: 0,
      transactionCurrency: transactionAmountDetails.transactionCurrency,
    }
    const currentTotalTransactionsAmount: TransactionAmountDetails =
      transactionsAmount.get('ALL') ?? defaultTransactionAmount
    const targetCurrency = currentTotalTransactionsAmount.transactionCurrency
    const targetAmount = await getTargetCurrencyAmount(
      transactionAmountDetails,
      targetCurrency
    )
    transactionsAmount.set('ALL', {
      transactionAmount:
        targetAmount.transactionAmount +
        currentTotalTransactionsAmount.transactionAmount,
      transactionCurrency: targetCurrency,
    })
    if (paymentMethod) {
      const currentTotalPaymentMethodTransactionsAmount: TransactionAmountDetails =
        transactionsAmount.get(paymentMethod) ?? defaultTransactionAmount
      const targetCurrency =
        currentTotalPaymentMethodTransactionsAmount.transactionCurrency
      const targetAmount = await getTargetCurrencyAmount(
        transactionAmountDetails,
        targetCurrency
      )
      transactionsAmount.set(paymentMethod, {
        transactionAmount:
          targetAmount.transactionAmount +
          currentTotalPaymentMethodTransactionsAmount.transactionAmount,
        transactionCurrency: targetCurrency,
      })
    }

    // Transaction count
    transactionsCount.set('ALL', (transactionsCount.get('ALL') ?? 0) + 1)
    if (paymentMethod) {
      transactionsCount.set(
        paymentMethod,
        (transactionsCount.get(paymentMethod) ?? 0) + 1
      )
    }

    const transactionAmountKey: keyof UserTimeAggregationAttributes =
      direction === 'origin'
        ? 'sendingTransactionsAmount'
        : 'receivingTransactionsAmount'
    const transactionCountKey: keyof UserTimeAggregationAttributes =
      direction === 'origin'
        ? 'sendingTransactionsCount'
        : 'receivingTransactionsCount'
    const ttl =
      Math.floor(Date.now() / 1000) +
      duration(1, 'year').asSeconds() +
      duration(7, 'day').asSeconds()
    const updateItemInput: UpdateCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_TIME_AGGREGATION(
        this.tenantId,
        userId,
        this.getTransactionStatsTimeGroupLabel(timestamp, timeGranularity),
        this.USER_TRANSACTION_STATS_VERSION
      ),
      UpdateExpression: `SET ${transactionAmountKey} = :amount, ${transactionCountKey} = :count, #ttl = :ttl`,
      ExpressionAttributeValues: {
        ':amount': Object.fromEntries(transactionsAmount.entries()),
        ':count': Object.fromEntries(transactionsCount.entries()),
        ':ttl': ttl,
      },
      ExpressionAttributeNames: {
        '#ttl': 'ttl',
      },
      ReturnValues: 'UPDATED_NEW',
    }
    await this.dynamoDb.send(new UpdateCommand(updateItemInput))
  }

  public async getUserTransactionStatsTimeGroup(
    userId: string,
    timestamp: number,
    timeGranularity: 'day' | 'week' | 'month' | 'year'
  ): Promise<UserTimeAggregationAttributes> {
    const attributes: Array<keyof UserTimeAggregationAttributes> = [
      'sendingTransactionsAmount',
      'sendingTransactionsCount',
      'receivingTransactionsAmount',
      'receivingTransactionsCount',
    ]
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.USER_TIME_AGGREGATION(
        this.tenantId,
        userId,
        this.getTransactionStatsTimeGroupLabel(timestamp, timeGranularity),
        this.USER_TRANSACTION_STATS_VERSION
      ),
      ProjectionExpression: attributes.join(','),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    const {
      sendingTransactionsAmount,
      sendingTransactionsCount,
      receivingTransactionsAmount,
      receivingTransactionsCount,
    } = result.Item ?? {}
    return {
      sendingTransactionsAmount: new Map(
        Object.entries(sendingTransactionsAmount ?? {})
      ) as Map<PaymentMethod | 'ALL', TransactionAmountDetails>,
      sendingTransactionsCount: new Map(
        Object.entries(sendingTransactionsCount ?? {})
      ) as Map<PaymentMethod | 'ALL', number>,
      receivingTransactionsAmount: new Map(
        Object.entries(receivingTransactionsAmount ?? {})
      ) as Map<PaymentMethod | 'ALL', TransactionAmountDetails>,
      receivingTransactionsCount: new Map(
        Object.entries(receivingTransactionsCount ?? {})
      ) as Map<PaymentMethod | 'ALL', number>,
    }
  }

  // TODO: We use UTC time for getting the time label for now. We could use
  // the customer specified timezone if there's a need.
  public getTransactionStatsTimeGroupLabel(
    timestamp: number,
    timeGranularity: 'day' | 'week' | 'month' | 'year'
  ): string {
    switch (timeGranularity) {
      case 'day':
        return dayjs(timestamp).format('YYYY-MM-DD')
      case 'week': {
        const time = dayjs(timestamp)
        return `${time.format('YYYY')}-W${time.week()}`
      }
      case 'month':
        return dayjs(timestamp).format('YYYY-MM')
      case 'year':
        return dayjs(timestamp).format('YYYY')
    }
  }

  /**
   *  User rule time aggregation
   */

  public async rebuildUserRuleTimeAggregations(
    userKeyId: string,
    ruleInstanceId: string,
    aggregationData: {
      [hour: string]: any
    },
    version: string
  ) {
    const writeRequests = Object.entries(aggregationData).map((entry) => {
      const keys = DynamoDbKeys.RULE_USER_TIME_AGGREGATION(
        this.tenantId,
        userKeyId,
        ruleInstanceId,
        version,
        entry[0]
      )
      return {
        PutRequest: {
          Item: {
            ...keys,
            ...entry[1],
          },
        },
      }
    })
    await batchWrite(
      this.dynamoDb,
      writeRequests,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME
    )
  }

  public async getUserRuleTimeAggregations<T>(
    userKeyId: string,
    ruleInstanceId: string,
    afterTimestamp: number,
    beforeTimestamp: number,
    timeLabelFormat: string,
    version: string
  ): Promise<Array<T & { hour: string }> | undefined> {
    const queryInput: QueryCommandInput = dynamoDbQueryHelper({
      tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      sortKey: {
        from: dayjs(afterTimestamp).format(timeLabelFormat),
        to: dayjs(beforeTimestamp - 1).format(timeLabelFormat),
      },
      partitionKey: DynamoDbKeys.RULE_USER_TIME_AGGREGATION(
        this.tenantId,
        userKeyId,
        ruleInstanceId,
        version
      ).PartitionKeyID,
    })

    const result = await paginateQuery(this.dynamoDb, queryInput)
    const hasData = (result?.Items?.length || 0) > 0
    if (!hasData) {
      const isRebuilt = await this.isUserRuleTimeAggregationsRebuilt(
        userKeyId,
        ruleInstanceId,
        version
      )
      if (isRebuilt) {
        // We return an empty array instead of undefined as it's not a cache miss.
        return []
      }
    }

    return hasData
      ? result?.Items?.map((item) => ({
          ...(_.omit(item, ['PartitionKeyID', 'SortKeyID']) as T),
          hour: item.SortKeyID,
        }))
      : undefined
  }

  private async isUserRuleTimeAggregationsRebuilt(
    userKeyId: string,
    ruleInstanceId: string,
    version: string
  ): Promise<boolean> {
    const queryInput: QueryCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.RULE_USER_TIME_AGGREGATION(
          this.tenantId,
          userKeyId,
          ruleInstanceId,
          version
        ).PartitionKeyID,
      },
      Limit: 1,
    }
    const result = await paginateQuery(this.dynamoDb, queryInput)
    return Boolean(result.Count)
  }

  public async markTransactionApplied(
    ruleInstanceId: string,
    direction: 'origin' | 'destination',
    version: string,
    transactionId: string,
    ttl: number
  ): Promise<void> {
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE_USER_TIME_AGGREGATION_MARKER(
          this.tenantId,
          ruleInstanceId,
          direction,
          version,
          transactionId
        ),
        ttl,
      },
    }
    await this.dynamoDb.send(new PutCommand(putItemInput))
  }

  public async isTransactionApplied(
    ruleInstanceId: string,
    direction: 'origin' | 'destination',
    version: string,
    transactionId: string
  ): Promise<boolean> {
    const getItemInput: GetCommandInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.RULE_USER_TIME_AGGREGATION_MARKER(
        this.tenantId,
        ruleInstanceId,
        direction,
        version,
        transactionId
      ),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))
    return Boolean(result.Item)
  }
}
