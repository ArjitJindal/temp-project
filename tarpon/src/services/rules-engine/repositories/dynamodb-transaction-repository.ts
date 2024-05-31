import { v4 as uuidv4 } from 'uuid'
import { chunk, get, isEmpty, omit, pickBy, set, sum, uniq } from 'lodash'
import { StackConstants } from '@lib/constants'
import {
  BatchGetCommand,
  BatchGetCommandInput,
  BatchWriteCommand,
  BatchWriteCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import {
  getNonUserReceiverKeys,
  getNonUserSenderKeys,
  getReceiverKeys,
  getSenderKeys,
  getUserReceiverKeys,
  getUserSenderKeys,
} from '../utils'
import { transactionTimeRangeRuleFilterPredicate } from '../transaction-filters/utils/helpers'
import {
  AuxiliaryIndexTransaction,
  RulesEngineTransactionRepositoryInterface,
  TimeRange,
  TransactionsFilterOptions,
} from './transaction-repository-interface'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import {
  DynamoDbKeys,
  TRANSACTION_ID_SUFFIX_DEPLOYED_TIME,
} from '@/core/dynamodb/dynamodb-keys'
import { getTimestampBasedIDPrefix } from '@/utils/timestampUtils'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import {
  dynamoDbQueryHelper,
  paginateQuery,
  paginateQueryGenerator,
} from '@/utils/dynamodb'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { mergeObjects } from '@/utils/object'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Undefined } from '@/utils/lang'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { envIs } from '@/utils/env'
import { traceable } from '@/core/xray'

export function getNewTransactionID(transaction: Transaction) {
  return (
    transaction.transactionId ||
    `${getTimestampBasedIDPrefix(transaction.timestamp)}-${uuidv4()}`
  )
}

@traceable
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
      if (get(transaction, path) === 'N/A') {
        set(transaction, path, undefined)
      }
    })
  }

  public async saveTransaction(
    transaction: Transaction,
    rulesResult: Undefined<TransactionMonitoringResult> = {}
  ): Promise<Transaction> {
    this.sanitizeTransactionInPlace(transaction)
    transaction.transactionId = getNewTransactionID(transaction)
    transaction.timestamp = transaction.timestamp || Date.now()

    const primaryKey = DynamoDbKeys.TRANSACTION(
      this.tenantId,
      transaction.transactionId
    )

    const auxiliaryIndexes = this.getTransactionAuxiliaryIndexes(transaction)
    const batchWriteItemParams: BatchWriteCommandInput = {
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
          ...auxiliaryIndexes.map((item) => ({
            PutRequest: {
              Item: item,
            },
          })),
        ],
      },
    }
    await this.dynamoDb.send(new BatchWriteCommand(batchWriteItemParams))

    await this.removeOldAuxiliaryIndexesIfNeeded(
      transaction.timestamp,
      auxiliaryIndexes
    )

    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(primaryKey)
    }
    return transaction
  }

  public async deleteTransaction(transaction: Transaction): Promise<void> {
    const primaryKey = DynamoDbKeys.TRANSACTION(
      this.tenantId,
      transaction.transactionId
    )
    const auxiliaryIndexes = this.getTransactionAuxiliaryIndexes(transaction)

    const batchWriteItemParams: BatchWriteCommandInput = {
      RequestItems: {
        [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: [
          {
            DeleteRequest: {
              Key: primaryKey,
            },
          },
          ...auxiliaryIndexes.map((item) => ({
            DeleteRequest: {
              Key: {
                PartitionKeyID: item.PartitionKeyID,
                SortKeyID: item.SortKeyID,
              },
            },
          })),
        ],
      },
    }

    await this.dynamoDb.send(new BatchWriteCommand(batchWriteItemParams))
  }

  // TODO: We can remove this after 2024-04-01 assuming that a transaction event won't be created
  // for a transaction which was created more than 6 months ago
  private async removeOldAuxiliaryIndexesIfNeeded(
    transactionTimestamp: number,
    auxiliaryIndexes: Array<{ PartitionKeyID: string; SortKeyID: string }>
  ) {
    if (
      transactionTimestamp > TRANSACTION_ID_SUFFIX_DEPLOYED_TIME.valueOf() ||
      auxiliaryIndexes.length === 0 ||
      !envIs('prod')
    ) {
      return
    }
    const batchWriteItemParams: BatchWriteCommandInput = {
      RequestItems: {
        [StackConstants.TARPON_DYNAMODB_TABLE_NAME]: auxiliaryIndexes.map(
          (key) => ({
            DeleteRequest: {
              Key: {
                PartitionKeyID: key.PartitionKeyID,
                SortKeyID: key.SortKeyID.split('-')[0],
              },
            },
          })
        ),
      },
    }
    await this.dynamoDb.send(new BatchWriteCommand(batchWriteItemParams))
  }

  public getTransactionAuxiliaryIndexes(transaction: Transaction) {
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
    const originIpAddress = transaction?.originDeviceData?.ipAddress
    const destinationIpAddress = transaction?.destinationDeviceData?.ipAddress

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
      originIpAddress && {
        ...DynamoDbKeys.ORIGIN_IP_ADDRESS_TRANSACTION(
          this.tenantId,
          originIpAddress,
          {
            timestamp: transaction.timestamp,
            transactionId: transaction.transactionId,
          }
        ),
        senderKeyId: senderKeys?.PartitionKeyID,
        receiverKeyId: receiverKeys?.PartitionKeyID,
      },
      destinationIpAddress && {
        ...DynamoDbKeys.DESTINATION_IP_ADDRESS_TRANSACTION(
          this.tenantId,
          destinationIpAddress,
          {
            timestamp: transaction.timestamp,
            transactionId: transaction.transactionId,
          }
        ),
        senderKeyId: senderKeys?.PartitionKeyID,
        receiverKeyId: receiverKeys?.PartitionKeyID,
      },
    ]
      .filter(Boolean)
      .map((key) => ({
        ...transaction,
        ...(key as {
          PartitionKeyID: string
          SortKeyID: string
        }),
      }))
  }

  public async getTransactionById(
    transactionId: string
  ): Promise<TransactionWithRulesResult | null> {
    const getItemInput: GetCommandInput = {
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

    delete transaction.createdAt
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

  public async checkTransactionStatusByChunk(
    transactionIds: string[],
    checkStatus: (txns: TransactionWithRulesResult[]) => boolean
  ): Promise<boolean> {
    for (const transactionIdsChunk of chunk(transactionIds, 100)) {
      const txns = (await this.getTransactionsByIdsChunk(
        transactionIdsChunk,
        TransactionWithRulesResult.getAttributeTypeMap()
      )) as TransactionWithRulesResult[]
      if (!checkStatus(txns)) {
        return false
      }
    }
    return true
  }

  private async getTransactionsByIdsChunk(
    transactionIds: string[],
    transactionAttributeMap: Array<{
      name: string
      baseName: string
      type: string
      format: string
    }> = Transaction.getAttributeTypeMap()
  ): Promise<Transaction[] | TransactionWithRulesResult[]> {
    if (transactionIds.length > 100) {
      // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html
      throw new Error('Can only get at most 100 transactions at a time!')
    }
    if (transactionIds.length === 0) {
      return []
    }

    const transactionAttributeNames = transactionAttributeMap.map(
      (attribute) => attribute.name
    )
    const batchGetItemInput: BatchGetCommandInput = {
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
    const queryInput: QueryCommandInput = {
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
    return (result.Items?.length ?? 0) > 0
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
    const queryInput: QueryCommandInput = {
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
      omit(item, ['PartitionKeyID', 'SortKeyID'])
    ) || []) as Array<AuxiliaryIndexTransaction>
  }

  public async *getGenericUserSendingTransactionsGenerator(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    if (userId && !matchPaymentMethodDetails) {
      yield* this.getUserSendingTransactionsGenerator(
        userId,
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else if (paymentDetails) {
      yield* this.getNonUserSendingTransactionsGenerator(
        paymentDetails,
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else {
      yield []
    }
  }

  public async *getGenericUserReceivingTransactionsGenerator(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    if (userId && !matchPaymentMethodDetails) {
      yield* this.getUserReceivingTransactionsGenerator(
        userId,
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else if (paymentDetails) {
      yield* this.getNonUserReceivingTransactionsGenerator(
        paymentDetails,
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else {
      yield []
    }
  }

  public async *getUserSendingTransactionsGenerator(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    for (const transactionType of getTransactionTypes(
      filterOptions?.transactionTypes
    )) {
      yield* this.getDynamoDBTransactionsGenerator(
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
    }
  }

  // TODO: Remove this after all rules support streaming
  public async getUserSendingTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const generator = this.getUserSendingTransactionsGenerator(
      userId,
      timeRange,
      filterOptions,
      attributesToFetch
    )
    const transactions: Array<AuxiliaryIndexTransaction> = []
    for await (const data of generator) {
      transactions.push(...data)
    }
    return transactions
  }

  // TODO: Remove this after all rules support streaming
  public async getUserReceivingTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const generator = this.getUserReceivingTransactionsGenerator(
      userId,
      timeRange,
      filterOptions,
      attributesToFetch
    )
    const transactions: Array<AuxiliaryIndexTransaction> = []
    for await (const data of generator) {
      transactions.push(...data)
    }
    return transactions
  }

  public async *getUserReceivingTransactionsGenerator(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    for (const transactionType of getTransactionTypes(
      filterOptions?.transactionTypes
    )) {
      yield* this.getDynamoDBTransactionsGenerator(
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
    }
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
    return sum(results)
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
    return sum(results)
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
    return sum(results)
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
    return sum(results)
  }

  public async *getNonUserSendingTransactionsGenerator(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    for (const transactionType of getTransactionTypes(
      filterOptions?.transactionTypes
    )) {
      const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
        this.tenantId,
        paymentDetails,
        'sending',
        transactionType
      )?.PartitionKeyID
      if (partitionKeyId) {
        yield* this.getDynamoDBTransactionsGenerator(
          partitionKeyId,
          timeRange,
          filterOptions,
          attributesToFetch
        )
      } else {
        yield []
      }
    }
  }

  public async *getNonUserReceivingTransactionsGenerator(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    for (const transactionType of getTransactionTypes(
      filterOptions?.transactionTypes
    )) {
      const partitionKeyId = DynamoDbKeys.NON_USER_TRANSACTION(
        this.tenantId,
        paymentDetails,
        'receiving',
        transactionType
      )?.PartitionKeyID
      if (partitionKeyId) {
        yield* this.getDynamoDBTransactionsGenerator(
          partitionKeyId,
          timeRange,
          filterOptions,
          attributesToFetch
        )
      } else {
        yield []
      }
    }
  }

  public async getIpAddressTransactions(
    ipAddress: string,
    timeRange: TimeRange,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const originTransactions = await this.getDynamoDBTransactions(
      DynamoDbKeys.ORIGIN_IP_ADDRESS_TRANSACTION(this.tenantId, ipAddress)
        .PartitionKeyID,
      timeRange,
      {},
      attributesToFetch
    )

    const destinationTransactions = await this.getDynamoDBTransactions(
      DynamoDbKeys.DESTINATION_IP_ADDRESS_TRANSACTION(this.tenantId, ipAddress)
        .PartitionKeyID,
      timeRange,
      {},
      attributesToFetch
    )

    return sortTransactionsDescendingTimestamp([
      ...new Set([...originTransactions, ...destinationTransactions]),
    ])
  }

  private getTransactionsQuery(
    partitionKeyId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): QueryCommandInput {
    const transactionFilterQuery = this.getTransactionFilterQueryInput(
      filterOptions,
      attributesToFetch
    )

    const queryInput: QueryCommandInput = dynamoDbQueryHelper({
      tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      filterExpression: transactionFilterQuery.FilterExpression,
      expressionAttributeNames: transactionFilterQuery.ExpressionAttributeNames,
      expressionAttributeValues:
        transactionFilterQuery.ExpressionAttributeValues,
      scanIndexForward: false,
      projectionExpression: transactionFilterQuery.ProjectionExpression,
      partitionKey: partitionKeyId,
      sortKey: {
        from: `${timeRange.afterTimestamp}`,
        // NOTE: As we're appending transaction ID to the sort key, we don't need to minus one for 'to'
        // as `{timeRange.beforeTimestamp}` is always smaller than `{timeRange.beforeTimestamp}-{transactionId}`
        to: `${timeRange.beforeTimestamp}`,
      },
    })

    return queryInput
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
        uniq([...attributesToFetch, 'timestamp'])
      )
    )
    const transactions = (result.Items?.map((item) =>
      omit(item, ['PartitionKeyID', 'SortKeyID'])
    ) || []) as Array<AuxiliaryIndexTransaction>
    const transactionTimeRange = filterOptions.transactionTimeRange24hr
    return transactionTimeRange
      ? transactions.filter((transaction) =>
          transactionTimeRangeRuleFilterPredicate(
            transaction.timestamp ?? 0,
            transactionTimeRange
          )
        )
      : transactions
  }

  private async *getDynamoDBTransactionsGenerator(
    partitionKeyId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    const generator = paginateQueryGenerator(
      this.dynamoDb,
      this.getTransactionsQuery(
        partitionKeyId,
        timeRange,
        filterOptions,
        uniq([...attributesToFetch, 'timestamp'])
      )
    )
    for await (const data of generator) {
      const transactions = (data.Items?.map((item) =>
        omit(item, ['PartitionKeyID', 'SortKeyID'])
      ) || []) as Array<AuxiliaryIndexTransaction>
      const transactionTimeRange = filterOptions.transactionTimeRange24hr
      yield transactionTimeRange
        ? transactions.filter(
            (transaction) =>
              transaction.timestamp &&
              transactionTimeRangeRuleFilterPredicate(
                transaction.timestamp,
                transactionTimeRange
              )
          )
        : transactions
    }
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
    rawAttributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Partial<QueryCommandInput> {
    const attributesToFetch = [...rawAttributesToFetch]
    if (
      attributesToFetch.length > 0 &&
      !attributesToFetch.includes('timestamp')
    ) {
      attributesToFetch.push('timestamp')
    }
    const transactionStatesParams = filterOptions.transactionStates?.map(
      (transactionState, index) => [
        `:transactionState${index}`,
        transactionState,
      ]
    )
    const transactionStatesKeys = transactionStatesParams?.map(
      (params) => params[0]
    )
    const originPaymentMethodsParams = filterOptions.originPaymentMethods?.map(
      (paymentMethod, index) => [`:originPaymentMethod${index}`, paymentMethod]
    )
    const originPaymentMethodsKeys = originPaymentMethodsParams?.map(
      (params) => params[0]
    )
    const destinationPaymentMethodsParams =
      filterOptions.destinationPaymentMethods?.map((paymentMethod, index) => [
        `:destinationPaymentMethod${index}`,
        paymentMethod,
      ])
    const destinationPaymentMethodsKeys = destinationPaymentMethodsParams?.map(
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
    const transactionAmountParams = Object.entries(
      filterOptions.transactionAmountRange ?? {}
    ).flatMap((entry) => [
      [`:${entry[0]}`, entry[0]],
      [`:${entry[0]}_min`, entry[1].min ?? 0],
      [`:${entry[0]}_max`, entry[1].max ?? Number.MAX_SAFE_INTEGER],
    ])
    const transactionAmountStatement = Object.keys(
      filterOptions.transactionAmountRange ?? {}
    )
      .map((currency) => {
        const statement = [
          `(#originAmountDetails.#transactionCurrency = :${currency} AND (#originAmountDetails.#transactionAmount BETWEEN :${currency}_min AND :${currency}_max))`,
          'OR',
          `(#destinationAmountDetails.#transactionCurrency = :${currency} AND (#destinationAmountDetails.#transactionAmount BETWEEN :${currency}_min AND :${currency}_max))`,
        ].join(' ')
        return statement
      })
      .join(' OR ')
    const filters = [
      originPaymentMethodsKeys &&
        !isEmpty(originPaymentMethodsKeys) &&
        `#originPaymentDetails.#method IN (${originPaymentMethodsKeys.join(
          ','
        )})`,
      destinationPaymentMethodsKeys &&
        !isEmpty(destinationPaymentMethodsKeys) &&
        `#destinationPaymentDetails.#method IN (${destinationPaymentMethodsKeys.join(
          ','
        )})`,
      transactionStatesKeys &&
        !isEmpty(transactionStatesKeys) &&
        `transactionState IN (${transactionStatesKeys.join(',')})`,
      originCountriesKeys &&
        !isEmpty(originCountriesKeys) &&
        `#originAmountDetails.#country IN (${originCountriesKeys.join(',')})`,
      destinationCountriesKeys &&
        !isEmpty(destinationCountriesKeys) &&
        `#destinationAmountDetails.#country IN (${destinationCountriesKeys.join(
          ','
        )})`,
      filterOptions.transactionAmountRange &&
        !isEmpty(filterOptions.transactionAmountRange) &&
        transactionAmountStatement,
    ].filter(Boolean)

    if (isEmpty(filters) && isEmpty(attributesToFetch)) {
      return {}
    }

    const filterExpression = isEmpty(filters)
      ? undefined
      : filters.map((v) => (filters.length > 1 ? `(${v})` : v)).join(' AND ')
    const expressionAttributeNames = mergeObjects(
      pickBy(
        {
          '#originPaymentDetails': 'originPaymentDetails',
          '#destinationPaymentDetails': 'destinationPaymentDetails',
          '#method': 'method',
          '#originAmountDetails': 'originAmountDetails',
          '#destinationAmountDetails': 'destinationAmountDetails',
          '#transactionAmount': 'transactionAmount',
          '#transactionCurrency': 'transactionCurrency',
          '#country': 'country',
        },
        (_value, key) => filterExpression?.includes(key)
      ),
      attributesToFetch &&
        Object.fromEntries(attributesToFetch.map((name) => [`#${name}`, name]))
    ) as Record<string, string>

    return {
      FilterExpression: filterExpression,
      ExpressionAttributeNames: isEmpty(expressionAttributeNames)
        ? undefined
        : expressionAttributeNames,
      ExpressionAttributeValues: isEmpty(filters)
        ? undefined
        : {
            ...Object.fromEntries(transactionStatesParams || []),
            ...Object.fromEntries(originPaymentMethodsParams || []),
            ...Object.fromEntries(destinationPaymentMethodsParams || []),
            ...Object.fromEntries(originCountriesParams || []),
            ...Object.fromEntries(destinationCountriesParams || []),
            ...Object.fromEntries(transactionAmountParams || []),
          },
      ProjectionExpression: isEmpty(attributesToFetch)
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
  return transactionTypes && !isEmpty(transactionTypes)
    ? transactionTypes
    : [undefined]
}
