import { v4 as uuidv4 } from 'uuid'
import _, { chunk } from 'lodash'
import { StackConstants } from '@lib/constants'
import { WriteRequest } from 'aws-sdk/clients/dynamodb'
import {
  BatchGetCommand,
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  getNonUserReceiverKeys,
  getNonUserSenderKeys,
  getReceiverKeys,
  getSenderKeys,
  getUserReceiverKeys,
  getUserSenderKeys,
} from '../utils'
import {
  AuxiliaryIndexTransaction,
  RulesEngineTransactionRepositoryInterface,
  TimeRange,
  TransactionsFilterOptions,
} from './transaction-repository-interface'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getTimestampBasedIDPrefix } from '@/utils/timestampUtils'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { paginateQuery } from '@/utils/dynamodb'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'
import { TransactionType } from '@/@types/openapi-public/TransactionType'

export function getNewTransactionID(transaction: Transaction) {
  return (
    transaction.transactionId ||
    `${getTimestampBasedIDPrefix(transaction.timestamp)}-${uuidv4()}`
  )
}

export class DynamoDbTransactionRepository
  implements RulesEngineTransactionRepositoryInterface
{
  dynamoDb: DynamoDBDocumentClient
  tenantId: string

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
  }

  private sanitizeTransactionInPlace(transaction: Transaction) {
    const COUNTRY_FIELD_PATHS = [
      'originPaymentDetails.cardIssuedCountry',
      'destinationPaymentDetails.cardIssuedCountry',
      'originAmountDetails.country',
      'destinationAmountDetails.country',
    ]
    COUNTRY_FIELD_PATHS.forEach((path) => {
      if (_.get(transaction, path) === 'N/A') {
        _.set(transaction, path, undefined)
      }
    })
  }

  public async saveTransaction(
    transaction: Transaction,
    rulesResult: {
      executedRules?: ExecutedRulesResult[]
      hitRules?: HitRulesDetails[]
    } = {}
  ): Promise<Transaction> {
    this.sanitizeTransactionInPlace(transaction)
    transaction.transactionId = getNewTransactionID(transaction)
    transaction.timestamp = transaction.timestamp || Date.now()

    const primaryKey = DynamoDbKeys.TRANSACTION(
      this.tenantId,
      transaction.transactionId
    )
    const batchWriteItemParams: AWS.DynamoDB.DocumentClient.BatchWriteItemInput =
      {
        RequestItems: {
          [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  ...primaryKey,
                  ...transaction,
                  ...rulesResult,
                },
              },
            },
            ...this.getTransactionAuxiliaryIndices(transaction).map((item) => ({
              PutRequest: {
                Item: item,
              },
            })),
          ] as unknown as WriteRequest[],
        },
      }
    await this.dynamoDb.send(new BatchWriteCommand(batchWriteItemParams))

    if (
      process.env.NODE_ENV === 'development' ||
      process.env.__INTERNAL_MONGODB_MIRROR__
    ) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(primaryKey)
    }
    return transaction
  }

  public getTransactionAuxiliaryIndices(transaction: Transaction) {
    const senderKeys = getSenderKeys(this.tenantId, transaction)
    const receiverKeys = getReceiverKeys(this.tenantId, transaction)
    const userSenderKeys = getUserSenderKeys(this.tenantId, transaction)
    const nonUserSenderKeys = getNonUserSenderKeys(this.tenantId, transaction)
    const userReceiverKeys = getUserReceiverKeys(this.tenantId, transaction)
    const nonUserReceiverKeys = getNonUserReceiverKeys(
      this.tenantId,
      transaction
    )
    const senderKeysOfTransactionType =
      transaction.type === undefined
        ? undefined
        : getSenderKeys(this.tenantId, transaction, transaction.type)
    const receiverKeysOfTransactionType =
      transaction.type === undefined
        ? undefined
        : getReceiverKeys(this.tenantId, transaction, transaction.type)
    const userSenderKeysOfTransactionType =
      transaction.type &&
      getUserSenderKeys(this.tenantId, transaction, transaction.type)
    const nonUserSenderKeysOfTransactionType =
      transaction.type &&
      getNonUserSenderKeys(this.tenantId, transaction, transaction.type)
    const userReceiverKeysOfTransactionType =
      transaction.type &&
      getUserReceiverKeys(this.tenantId, transaction, transaction.type)
    const nonUserReceiverKeysOfTransactionType =
      transaction.type &&
      getNonUserReceiverKeys(this.tenantId, transaction, transaction.type)

    // IMPORTANT: Added/Deleted keys here should be reflected in nuke-tenant-data.ts as well
    return [
      userSenderKeys && {
        ...userSenderKeys,
        senderKeyId: senderKeys?.PartitionKeyID,
        receiverKeyId: receiverKeys?.PartitionKeyID,
      },
      nonUserSenderKeys && {
        ...nonUserSenderKeys,
        senderKeyId: senderKeys?.PartitionKeyID,
        receiverKeyId: receiverKeys?.PartitionKeyID,
      },
      userReceiverKeys && {
        ...userReceiverKeys,
        senderKeyId: senderKeys?.PartitionKeyID,
        receiverKeyId: receiverKeys?.PartitionKeyID,
      },
      nonUserReceiverKeys && {
        ...nonUserReceiverKeys,
        senderKeyId: senderKeys?.PartitionKeyID,
        receiverKeyId: receiverKeys?.PartitionKeyID,
      },
      userSenderKeysOfTransactionType && {
        ...userSenderKeysOfTransactionType,
        senderKeyId: senderKeysOfTransactionType?.PartitionKeyID,
        receiverKeyId: receiverKeysOfTransactionType?.PartitionKeyID,
      },
      nonUserSenderKeysOfTransactionType && {
        ...nonUserSenderKeysOfTransactionType,
        senderKeyId: senderKeysOfTransactionType?.PartitionKeyID,
        receiverKeyId: receiverKeysOfTransactionType?.PartitionKeyID,
      },
      userReceiverKeysOfTransactionType && {
        ...userReceiverKeysOfTransactionType,
        senderKeyId: senderKeysOfTransactionType?.PartitionKeyID,
        receiverKeyId: receiverKeysOfTransactionType?.PartitionKeyID,
      },
      nonUserReceiverKeysOfTransactionType && {
        ...nonUserReceiverKeysOfTransactionType,
        senderKeyId: senderKeysOfTransactionType?.PartitionKeyID,
        receiverKeyId: receiverKeysOfTransactionType?.PartitionKeyID,
      },
      transaction?.deviceData?.ipAddress && {
        ...DynamoDbKeys.IP_ADDRESS_TRANSACTION(
          this.tenantId,
          transaction.deviceData.ipAddress,
          transaction.timestamp
        ),
        senderKeyId: senderKeys?.PartitionKeyID,
        receiverKeyId: receiverKeys?.PartitionKeyID,
      },
    ]
      .filter(Boolean)
      .map((key) => ({
        ...(key as {
          PartitionKeyID: string
          SortKeyID: string
        }),
        ...transaction,
      }))
  }

  public async getTransactionById(
    transactionId: string
  ): Promise<TransactionWithRulesResult | null> {
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
    }
    const result = await this.dynamoDb.send(new GetCommand(getItemInput))

    if (!result.Item) {
      return null
    }

    const transaction = {
      ...result.Item,
    }
    delete transaction.PartitionKeyID
    delete transaction.SortKeyID
    return transaction as TransactionWithRulesResult
  }

  public async getTransactionsByIds(
    transactionIds: string[]
  ): Promise<Transaction[]> {
    return (
      await Promise.all(
        chunk(transactionIds, 100).map((transactionIdsChunk) =>
          this.getTransactionsByIdsChunk(transactionIdsChunk)
        )
      )
    ).flatMap((e) => e)
  }

  private async getTransactionsByIdsChunk(
    transactionIds: string[]
  ): Promise<Transaction[]> {
    if (transactionIds.length > 100) {
      // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html
      throw new Error('Can only get at most 100 transactions at a time!')
    }
    if (transactionIds.length === 0) {
      return []
    }

    const transactionAttributeNames = Transaction.getAttributeTypeMap().map(
      (attribute) => attribute.name
    )
    const batchGetItemInput: AWS.DynamoDB.DocumentClient.BatchGetItemInput = {
      RequestItems: {
        [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: {
          Keys: Array.from(new Set(transactionIds)).map((transactionId) =>
            DynamoDbKeys.TRANSACTION(this.tenantId, transactionId)
          ),
          ProjectionExpression: transactionAttributeNames
            .map((name) => `#${name}`)
            .join(', '),
          ExpressionAttributeNames: Object.fromEntries(
            transactionAttributeNames.map((name) => [`#${name}`, name])
          ),
        },
      },
    }
    const result = await this.dynamoDb.send(
      new BatchGetCommand(batchGetItemInput)
    )
    return (
      (result.Responses?.[
        StackConstants.TARPON_DYNAMODB_TABLE_NAME
      ] as Transaction[]) || []
    )
  }
  public async hasAnySendingTransaction(
    userId: string,
    filterOptions: TransactionsFilterOptions
  ): Promise<boolean> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) =>
          this.hasAnySendingTransactionPrivate(
            userId,
            transactionType,
            filterOptions
          )
      )
    )
    return results.includes(true)
  }

  private async hasAnySendingTransactionPrivate(
    userId: string,
    transactionType: TransactionType | undefined,
    filterOptions: TransactionsFilterOptions
  ): Promise<boolean> {
    const transactionFilterQuery = this.getTransactionFilterQueryInput(
      filterOptions,
      []
    )
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': DynamoDbKeys.USER_TRANSACTION(
          this.tenantId,
          userId,
          'sending',
          transactionType
        ).PartitionKeyID,
        ...transactionFilterQuery.ExpressionAttributeValues,
      },
      ExpressionAttributeNames: transactionFilterQuery.ExpressionAttributeNames,
      Limit: 1,
    }
    const result = await paginateQuery(this.dynamoDb, queryInput)
    return !!result.Count
  }

  public async getLastNUserSendingTransactions(
    userId: string,
    n: number,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) =>
          this.getLastNTransactions(
            DynamoDbKeys.USER_TRANSACTION(
              this.tenantId,
              userId,
              'sending',
              transactionType
            ).PartitionKeyID,
            n,
            filterOptions,
            attributesToFetch
          )
      )
    )
    return sortTransactionsDescendingTimestamp(results.flatMap((t) => t))
  }

  public async getLastNUserReceivingTransactions(
    userId: string,
    n: number,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) =>
          this.getLastNTransactions(
            DynamoDbKeys.USER_TRANSACTION(
              this.tenantId,
              userId,
              'receiving',
              transactionType
            ).PartitionKeyID,
            n,
            filterOptions,
            attributesToFetch
          )
      )
    )
    return sortTransactionsDescendingTimestamp(results.flatMap((t) => t))
  }

  private async getLastNTransactions(
    partitionKeyId: string,
    n: number,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const transactionFilterQuery = this.getTransactionFilterQueryInput(
      filterOptions,
      attributesToFetch
    )
    const queryInput: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ...transactionFilterQuery.ExpressionAttributeValues,
      },
      ExpressionAttributeNames: transactionFilterQuery.ExpressionAttributeNames,
      ProjectionExpression: transactionFilterQuery.ProjectionExpression,
      Limit: n,
      ScanIndexForward: false,
    }
    const result = await paginateQuery(this.dynamoDb, queryInput)
    return (result.Items?.map((item) =>
      _.omit(item, ['PartitionKeyID', 'SortKeyID'])
    ) || []) as Array<AuxiliaryIndexTransaction>
  }

  public async getGenericUserSendingTransactions(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    return userId && !matchPaymentMethodDetails
      ? this.getUserSendingTransactions(
          userId,
          timeRange,
          filterOptions,
          attributesToFetch
        )
      : paymentDetails
      ? this.getNonUserSendingTransactions(
          paymentDetails,
          timeRange,
          filterOptions,
          attributesToFetch
        )
      : []
  }

  public async getGenericUserReceivingTransactions(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    return userId && !matchPaymentMethodDetails
      ? this.getUserReceivingTransactions(
          userId,
          timeRange,
          filterOptions,
          attributesToFetch
        )
      : paymentDetails
      ? this.getNonUserReceivingTransactions(
          paymentDetails,
          timeRange,
          filterOptions,
          attributesToFetch
        )
      : []
  }

  public async getUserSendingTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) =>
          this.getDynamoDBTransactions(
            DynamoDbKeys.USER_TRANSACTION(
              this.tenantId,
              userId,
              'sending',
              transactionType
            ).PartitionKeyID,
            timeRange,
            filterOptions,
            attributesToFetch
          )
      )
    )
    return sortTransactionsDescendingTimestamp(results.flatMap((t) => t))
  }

  public async getUserReceivingTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) =>
          this.getDynamoDBTransactions(
            DynamoDbKeys.USER_TRANSACTION(
              this.tenantId,
              userId,
              'receiving',
              transactionType
            ).PartitionKeyID,
            timeRange,
            filterOptions,
            attributesToFetch
          )
      )
    )
    return sortTransactionsDescendingTimestamp(results.flatMap((t) => t))
  }

  public async getGenericUserSendingTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ) {
    return userId
      ? await this.getUserSendingTransactionsCount(
          userId,
          timeRange,
          filterOptions
        )
      : paymentDetails
      ? await this.getNonUserSendingTransactionsCount(
          paymentDetails,
          timeRange,
          filterOptions
        )
      : 0
  }

  public async getGenericUserReceivingTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ) {
    return userId
      ? await this.getUserReceivingTransactionsCount(
          userId,
          timeRange,
          filterOptions
        )
      : paymentDetails
      ? await this.getNonUserReceivingTransactionsCount(
          paymentDetails,
          timeRange,
          filterOptions
        )
      : 0
  }

  public async getUserSendingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) =>
          this.getUserTransactionsCount(
            DynamoDbKeys.USER_TRANSACTION(
              this.tenantId,
              userId,
              'sending',
              transactionType
            ).PartitionKeyID,
            timeRange,
            filterOptions
          )
      )
    )
    return _.sum(results)
  }

  public async getUserReceivingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) =>
          this.getUserTransactionsCount(
            DynamoDbKeys.USER_TRANSACTION(
              this.tenantId,
              userId,
              'receiving',
              transactionType
            ).PartitionKeyID,
            timeRange,
            filterOptions
          )
      )
    )
    return _.sum(results)
  }

  public async getNonUserSendingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) => {
          const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
            this.tenantId,
            paymentDetails,
            'sending',
            transactionType
          )?.PartitionKeyID
          return partitionKeyId
            ? this.getUserTransactionsCount(
                partitionKeyId,
                timeRange,
                filterOptions
              )
            : { count: 0, scannedCount: 0 }
        }
      )
    )
    return _.sum(results)
  }

  public async getNonUserReceivingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) => {
          const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
            this.tenantId,
            paymentDetails,
            'receiving',
            transactionType
          )?.PartitionKeyID
          return partitionKeyId
            ? this.getUserTransactionsCount(
                partitionKeyId,
                timeRange,
                filterOptions
              )
            : { count: 0, scannedCount: 0 }
        }
      )
    )
    return _.sum(results)
  }

  public async getNonUserSendingTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) => {
          const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
            this.tenantId,
            paymentDetails,
            'sending',
            transactionType
          )?.PartitionKeyID
          return partitionKeyId
            ? this.getDynamoDBTransactions(
                partitionKeyId,
                timeRange,
                filterOptions,
                attributesToFetch
              )
            : []
        }
      )
    )
    return sortTransactionsDescendingTimestamp(results.flatMap((t) => t))
  }

  public async getNonUserReceivingTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const results = await Promise.all(
      getTransactionTypes(filterOptions?.transactionTypes).map(
        (transactionType) => {
          const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
            this.tenantId,
            paymentDetails,
            'receiving',
            transactionType
          )?.PartitionKeyID
          return partitionKeyId
            ? this.getDynamoDBTransactions(
                partitionKeyId,
                timeRange,
                filterOptions,
                attributesToFetch
              )
            : []
        }
      )
    )
    return sortTransactionsDescendingTimestamp(results.flatMap((t) => t))
  }

  public async getIpAddressTransactions(
    ipAddress: string,
    timeRange: TimeRange,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    return this.getDynamoDBTransactions(
      DynamoDbKeys.IP_ADDRESS_TRANSACTION(this.tenantId, ipAddress)
        .PartitionKeyID,
      timeRange,
      {},
      attributesToFetch
    )
  }

  private getTransactionsQuery(
    partitionKeyId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AWS.DynamoDB.DocumentClient.QueryInput {
    const transactionFilterQuery = this.getTransactionFilterQueryInput(
      filterOptions,
      attributesToFetch
    )
    return {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      KeyConditionExpression:
        'PartitionKeyID = :pk AND SortKeyID BETWEEN :skfrom AND :skto',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': partitionKeyId,
        ':skfrom': `${timeRange.afterTimestamp}`,
        ':skto': `${timeRange.beforeTimestamp - 1}`,
        ...transactionFilterQuery.ExpressionAttributeValues,
      },
      ExpressionAttributeNames: transactionFilterQuery.ExpressionAttributeNames,
      ProjectionExpression: transactionFilterQuery.ProjectionExpression,
      ScanIndexForward: false,
    }
  }

  private async getDynamoDBTransactions(
    partitionKeyId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const result = await paginateQuery(
      this.dynamoDb,
      this.getTransactionsQuery(
        partitionKeyId,
        timeRange,
        filterOptions,
        attributesToFetch
      )
    )
    return (result.Items?.map((item) =>
      _.omit(item, ['PartitionKeyID', 'SortKeyID'])
    ) || []) as Array<AuxiliaryIndexTransaction>
  }

  private async getUserTransactionsCount(
    partitionKeyId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const result = await paginateQuery(this.dynamoDb, {
      ...this.getTransactionsQuery(
        partitionKeyId,
        timeRange,
        filterOptions,
        []
      ),
      Select: 'COUNT',
    })
    return result.Count as number
  }

  private getTransactionFilterQueryInput(
    filterOptions: TransactionsFilterOptions = {},
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Partial<AWS.DynamoDB.DocumentClient.QueryInput> {
    const transactionStatesParams = filterOptions.transactionStates?.map(
      (transactionState, index) => [
        `:transactionState${index}`,
        transactionState,
      ]
    )
    const transactionStatesKeys = transactionStatesParams?.map(
      (params) => params[0]
    )
    const originCountriesParams = filterOptions.originCountries?.map(
      (country, index) => [`:originCountry${index}`, country]
    )
    const originCountriesKeys = originCountriesParams?.map(
      (params) => params[0]
    )
    const destinationCountriesParams = filterOptions.destinationCountries?.map(
      (country, index) => [`:destinationCountry${index}`, country]
    )
    const destinationCountriesKeys = destinationCountriesParams?.map(
      (params) => params[0]
    )
    const filters = [
      filterOptions.originPaymentMethod &&
        '#originPaymentDetails.#method = :originPaymentMethod',
      filterOptions.destinationPaymentMethod &&
        '#destinationPaymentDetails.#method = :destinationPaymentMethod',
      transactionStatesKeys &&
        `transactionState IN (${transactionStatesKeys.join(',')})`,
      originCountriesKeys &&
        `#originAmountDetails.#country IN (${originCountriesKeys.join(',')})`,
      destinationCountriesKeys &&
        `#destinationAmountDetails.#country IN (${destinationCountriesKeys.join(
          ','
        )})`,
    ].filter(Boolean)

    if (_.isEmpty(filters) && _.isEmpty(attributesToFetch)) {
      return {}
    }

    const expressionAttributeNames = _.merge(
      filterOptions.originPaymentMethod ||
        filterOptions.destinationPaymentMethod
        ? _.omitBy(
            {
              '#originPaymentDetails':
                filterOptions.originPaymentMethod && 'originPaymentDetails',
              '#destinationPaymentDetails':
                filterOptions.destinationPaymentMethod &&
                'destinationPaymentDetails',
              '#method':
                filterOptions.originPaymentMethod ||
                filterOptions.destinationPaymentMethod
                  ? 'method'
                  : undefined,
            },
            _.isNil
          )
        : undefined,
      filterOptions.originCountries || filterOptions.destinationCountries
        ? _.omitBy(
            {
              '#originAmountDetails':
                filterOptions.originCountries && 'originAmountDetails',
              '#destinationAmountDetails':
                filterOptions.destinationCountries &&
                'destinationAmountDetails',
              '#country': 'country',
            },
            _.isNil
          )
        : undefined,
      attributesToFetch &&
        Object.fromEntries(attributesToFetch.map((name) => [`#${name}`, name]))
    )

    return {
      FilterExpression: _.isEmpty(filters) ? undefined : filters.join(' AND '),
      ExpressionAttributeNames: _.isEmpty(expressionAttributeNames)
        ? undefined
        : expressionAttributeNames,
      ExpressionAttributeValues: _.isEmpty(filters)
        ? undefined
        : {
            ':originPaymentMethod': filterOptions.originPaymentMethod,
            ':destinationPaymentMethod': filterOptions.destinationPaymentMethod,
            ...Object.fromEntries(transactionStatesParams || []),
            ...Object.fromEntries(originCountriesParams || []),
            ...Object.fromEntries(destinationCountriesParams || []),
          },
      ProjectionExpression: _.isEmpty(attributesToFetch)
        ? undefined
        : attributesToFetch.map((name) => `#${name}`).join(', '),
    }
  }
}

function sortTransactionsDescendingTimestamp(
  transactions: AuxiliaryIndexTransaction[]
): AuxiliaryIndexTransaction[] {
  return transactions.sort(
    (transaction1, transaction2) =>
      (transaction2.timestamp || 0) - (transaction1.timestamp || 0)
  )
}

function getTransactionTypes(
  transactionTypes: TransactionType[] | undefined
): (TransactionType | undefined)[] {
  return transactionTypes || [undefined]
}
