import chunk from 'lodash/chunk'
import compact from 'lodash/compact'
import get from 'lodash/get'
import isEmpty from 'lodash/isEmpty'
import omit from 'lodash/omit'
import pickBy from 'lodash/pickBy'
import set from 'lodash/set'
import sum from 'lodash/sum'
import uniq from 'lodash/uniq'
import { StackConstants } from '@lib/constants'
import {
  BatchGetCommand,
  BatchGetCommandInput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandInput,
  QueryCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { MaxPriorityQueue } from '@datastructures-js/priority-queue'
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
  NonUserEntityData,
  RulesEngineTransactionRepositoryInterface,
  TimeRange,
  TransactionsFilterOptions,
} from './transaction-repository-interface'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import {
  batchGet,
  batchWrite,
  dynamoDbQueryHelper,
  itemLevelQueryGenerator,
  paginateQuery,
  paginateQueryGenerator,
  upsertSaveDynamo,
} from '@/utils/dynamodb'
import { mergeObjects } from '@/utils/object'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Undefined } from '@/utils/lang'
import { traceable } from '@/core/xray'
import { GeoIPService } from '@/services/geo-ip'
import { hydrateIpInfo } from '@/services/rules-engine/utils/geo-utils'
import { Address } from '@/@types/openapi-public/Address'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { runLocalChangeHandler } from '@/utils/local-change-handler'
import {
  AUXILLARY_TXN_PARTITION_COUNT,
  FUTURE_TIMESTAMP_TO_COMPARE,
  getAllBucketedPartitionKeys,
  sanitiseBucketedKey,
} from '@/core/dynamodb/key-utils'

type NonUserTransactionsFilterOptions = {
  originAddress?: Address
  destinationAddress?: Address
  originEmail?: string
  destinationEmail?: string
  originName?: string | ConsumerName
  destinationName?: string | ConsumerName
  beforeTimestamp: number
  afterTimestamp: number
}

@traceable
export class DynamoDbTransactionRepository
  implements RulesEngineTransactionRepositoryInterface
{
  dynamoDb: DynamoDBDocumentClient
  tenantId: string
  private geoService: GeoIPService

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
    this.tenantId = tenantId
    this.geoService = new GeoIPService(tenantId, dynamoDb)
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
    const transactions = await this.saveTransactions([
      { transaction, rulesResult },
    ])
    return transactions[0]
  }

  public saveDemoTransaction(
    transaction: Transaction,
    rulesResult?: Undefined<TransactionMonitoringResult>
  ) {
    this.sanitizeTransactionInPlace(transaction)
    transaction.timestamp = transaction.timestamp || Date.now()

    const primaryKey = DynamoDbKeys.TRANSACTION(
      this.tenantId,
      transaction.transactionId,
      transaction.timestamp
    )
    return {
      putItemInput: {
        PutRequest: {
          Item: {
            ...primaryKey,
            ...transaction,
            ...rulesResult,
          },
        },
      },
      tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
    }
  }

  public async saveTransactions(
    transactions: Array<{
      transaction: Transaction
      rulesResult?: Undefined<TransactionMonitoringResult>
    }>
  ): Promise<Transaction[]> {
    const primaryKeys: {
      PartitionKeyID: string
      SortKeyID: string | undefined
    }[] = []

    const writeRequests = await Promise.all(
      transactions.map(async ({ transaction, rulesResult = {} }) => {
        this.sanitizeTransactionInPlace(transaction)
        transaction.timestamp = transaction.timestamp || Date.now()

        await hydrateIpInfo(this.geoService, transaction)

        const primaryKey = DynamoDbKeys.TRANSACTION(
          this.tenantId,
          transaction.transactionId,
          transaction.timestamp
        )
        primaryKeys.push(primaryKey)

        const auxiliaryIndexes =
          this.getTransactionAuxiliaryIndexes(transaction)

        await upsertSaveDynamo(
          this.dynamoDb,
          {
            entity: { ...transaction, ...rulesResult },
            key: primaryKey,
            tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
          },
          { versioned: true }
        )

        const requests = auxiliaryIndexes.map((item) => ({
          PutRequest: {
            Item: item,
          },
        }))

        return requests
      })
    )

    await batchWrite(
      this.dynamoDb,
      writeRequests.flat(),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )

    if (runLocalChangeHandler()) {
      const { handleLocalTarponChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalTarponChangeCapture(this.tenantId, primaryKeys)
    }

    return transactions.map(({ transaction }) => transaction)
  }

  public async updateTransactionRulesResult(
    transactionId: string,
    rulesResult: Undefined<TransactionMonitoringResult> = {},
    timestamp: number
  ): Promise<void> {
    const primaryKey = DynamoDbKeys.TRANSACTION(
      this.tenantId,
      transactionId,
      timestamp
    )
    const executedRules = rulesResult.executedRules || []
    const hitRules = rulesResult.hitRules || []

    await this.dynamoDb.send(
      new UpdateCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: primaryKey,
        UpdateExpression: `SET executedRules = :executedRules, hitRules = :hitRules, #status = :status,  #updateCount = if_not_exists(#updateCount, :zero) + :one`,
        ExpressionAttributeValues: {
          ':executedRules': executedRules,
          ':hitRules': hitRules,
          ':status': rulesResult.status,
          ':zero': 0,
          ':one': 1,
        },
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updateCount': 'updateCount',
        },
      })
    )
    if (runLocalChangeHandler()) {
      const { handleLocalTarponChangeCapture } = await import(
        '@/core/local-handlers/tarpon'
      )

      await handleLocalTarponChangeCapture(this.tenantId, [primaryKey])
    }
  }

  public async deleteTransaction(transaction: Transaction): Promise<void> {
    const primaryKey = DynamoDbKeys.TRANSACTION(
      this.tenantId,
      transaction.transactionId,
      transaction.timestamp
    )
    const auxiliaryIndexes = this.getTransactionAuxiliaryIndexes(transaction)
    await batchWrite(
      this.dynamoDb,
      [
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
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )
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
    const sanitisedSenderKeyId = sanitiseBucketedKey(senderKeys?.PartitionKeyID)
    const sanitisedReceiverKeyId = sanitiseBucketedKey(
      receiverKeys?.PartitionKeyID
    )
    const sanitisedSenderKeyIdOfTransactionType = sanitiseBucketedKey(
      senderKeysOfTransactionType?.PartitionKeyID
    )
    const sanitisedReceiverKeyIdOfTransactionType = sanitiseBucketedKey(
      receiverKeysOfTransactionType?.PartitionKeyID
    )
    // IMPORTANT: Added/Deleted keys here should be reflected in nuke-tenant-data.ts as well
    return [
      userSenderKeys && {
        ...userSenderKeys,
        senderKeyId: sanitisedSenderKeyId,
        receiverKeyId: sanitisedReceiverKeyId,
      },
      nonUserSenderKeys && {
        ...nonUserSenderKeys,
        senderKeyId: sanitisedSenderKeyId,
        receiverKeyId: sanitisedReceiverKeyId,
      },
      userReceiverKeys && {
        ...userReceiverKeys,
        senderKeyId: sanitisedSenderKeyId,
        receiverKeyId: sanitisedReceiverKeyId,
      },
      nonUserReceiverKeys && {
        ...nonUserReceiverKeys,
        senderKeyId: sanitisedSenderKeyId,
        receiverKeyId: sanitisedReceiverKeyId,
      },
      userSenderKeysOfTransactionType && {
        ...userSenderKeysOfTransactionType,
        senderKeyId: sanitisedSenderKeyIdOfTransactionType,
        receiverKeyId: sanitisedReceiverKeyIdOfTransactionType,
      },
      nonUserSenderKeysOfTransactionType && {
        ...nonUserSenderKeysOfTransactionType,
        senderKeyId: sanitisedSenderKeyIdOfTransactionType,
        receiverKeyId: sanitisedReceiverKeyIdOfTransactionType,
      },
      userReceiverKeysOfTransactionType && {
        ...userReceiverKeysOfTransactionType,
        senderKeyId: sanitisedSenderKeyIdOfTransactionType,
        receiverKeyId: sanitisedReceiverKeyIdOfTransactionType,
      },
      nonUserReceiverKeysOfTransactionType && {
        ...nonUserReceiverKeysOfTransactionType,
        senderKeyId: sanitisedSenderKeyIdOfTransactionType,
        receiverKeyId: sanitisedReceiverKeyIdOfTransactionType,
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
        senderKeyId: sanitisedSenderKeyId,
        receiverKeyId: sanitisedReceiverKeyId,
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
        senderKeyId: sanitisedSenderKeyId,
        receiverKeyId: sanitisedReceiverKeyId,
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
    transactionId: string,
    attributesToFetch?: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<TransactionWithRulesResult | null> {
    const getItemInput = (newPartitionKey: boolean): GetCommandInput => ({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: newPartitionKey
        ? DynamoDbKeys.TRANSACTION(
            this.tenantId,
            transactionId,
            FUTURE_TIMESTAMP_TO_COMPARE
          ) // Future timestamp to always use new partition key)
        : DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
      ConsistentRead: true,
      ...(attributesToFetch
        ? { ProjectionExpression: attributesToFetch.join(', ') }
        : {}),
    })
    // Checking both partition as we don't have timestamp to check which partition to use
    const results = await Promise.all([
      this.dynamoDb.send(new GetCommand(getItemInput(false))),
      this.dynamoDb.send(new GetCommand(getItemInput(true))),
    ])
    const finalResult = compact(results.map((rest) => rest.Item))
    if (!finalResult[0]) {
      return null
    }
    const transaction = {
      ...finalResult[0],
    }

    delete transaction.createdAt
    delete transaction.PartitionKeyID
    delete transaction.SortKeyID
    return {
      ...transaction,
      executedRules: transaction.executedRules?.map((rule) => ({
        ...rule,
        sanctionsDetails: undefined, // delete sanctionsDetails from each executedRule in transaction
      })),
    } as TransactionWithRulesResult
  }

  public async getTransactionsByIds(
    transactionIds: string[]
  ): Promise<TransactionWithRulesResult[]> {
    const transactionAttributeNames =
      TransactionWithRulesResult.getAttributeTypeMap().map(
        (attribute) => attribute.name
      )
    // Checking both partition as we don't have timestamp to check which partition to use
    const transactions = await batchGet<TransactionWithRulesResult>(
      this.dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      transactionIds.flatMap((transactionId) => [
        DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
        DynamoDbKeys.TRANSACTION(
          this.tenantId,
          transactionId,
          FUTURE_TIMESTAMP_TO_COMPARE
        ), // Future timestamp to always use new partition key)
      ]),
      {
        ProjectionExpression: transactionAttributeNames
          .map((name) => `#${name}`)
          .join(', '),
        ExpressionAttributeNames: Object.fromEntries(
          transactionAttributeNames.map((name) => [`#${name}`, name])
        ),
        ConsistentRead: true,
      }
    )
    return transactions.map((transaction) => ({
      ...transaction,
      executedRules: transaction.executedRules?.map((rule) => ({
        ...rule,
        sanctionsDetails: undefined,
      })),
    }))
  }

  public async checkTransactionStatus(
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
        [StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)]: {
          Keys: Array.from(new Set(transactionIds)).flatMap((transactionId) => [
            DynamoDbKeys.TRANSACTION(this.tenantId, transactionId),
            DynamoDbKeys.TRANSACTION(
              this.tenantId,
              transactionId,
              FUTURE_TIMESTAMP_TO_COMPARE
            ), // Future timestamp to always use new partition key)
          ]),
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
        StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
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
    transactionType: string | undefined,
    filterOptions: TransactionsFilterOptions
  ): Promise<boolean> {
    const transactionFilterQuery = this.getTransactionFilterQueryInput(
      filterOptions,
      []
    )
    const queryInputs: QueryCommandInput[] = getAllBucketedPartitionKeys(
      DynamoDbKeys.USER_TRANSACTION(
        // As no sortKeyData so we will get the baseKey
        this.tenantId,
        userId,
        'sending',
        transactionType
      ).PartitionKeyID,
      AUXILLARY_TXN_PARTITION_COUNT
    ).map((key) => ({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': key,
        ...transactionFilterQuery.ExpressionAttributeValues,
      },
      ExpressionAttributeNames: transactionFilterQuery.ExpressionAttributeNames,
      Limit: 1,
    }))
    const result = await Promise.all(
      queryInputs.map((queryInput) => paginateQuery(this.dynamoDb, queryInput))
    )
    return result.some((res) => res.Items?.length ?? 0 > 0)
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
    // Generate all bucketed partition keys
    const partitionKeys = getAllBucketedPartitionKeys(
      partitionKeyId, // base partition key
      AUXILLARY_TXN_PARTITION_COUNT
    )

    // Create QueryCommandInput for each bucket
    const queryInputs: QueryCommandInput[] = partitionKeys.map((key) => ({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: 'PartitionKeyID = :pk',
      FilterExpression: transactionFilterQuery.FilterExpression,
      ExpressionAttributeValues: {
        ':pk': key,
        ...transactionFilterQuery.ExpressionAttributeValues,
      },
      ExpressionAttributeNames: transactionFilterQuery.ExpressionAttributeNames,
      ProjectionExpression: transactionFilterQuery.ProjectionExpression,
      Limit: n,
      ScanIndexForward: false,
    }))

    const results = await Promise.all(
      queryInputs.map((queryInput) => paginateQuery(this.dynamoDb, queryInput))
    )

    // Flatten all items and sort globally (newest first)
    const allItems = results.flatMap((res) => res.Items ?? [])
    allItems.sort((a, b) => (b.SortKeyID > a.SortKeyID ? 1 : -1))

    return allItems
      .slice(0, n)
      .map((item) =>
        omit(item, ['PartitionKeyID', 'SortKeyID'])
      ) as AuxiliaryIndexTransaction[]
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
      tableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
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
    const partitionKeys = getAllBucketedPartitionKeys(
      partitionKeyId,
      AUXILLARY_TXN_PARTITION_COUNT
    )

    const generators = partitionKeys.map((key) =>
      itemLevelQueryGenerator(
        this.dynamoDb,
        this.getTransactionsQuery(
          key,
          timeRange,
          filterOptions,
          uniq([...attributesToFetch, 'timestamp'])
        )
      )
    )
    // Priority queue ordered by SortKeyID
    const pq = new MaxPriorityQueue<{
      txn: AuxiliaryIndexTransaction & { SortKeyID: string }
      gen: AsyncGenerator<any>
    }>((data) => data.txn.SortKeyID)

    // Prime the queue with the first item from each generator
    for (const gen of generators) {
      const { value, done } = await gen.next()
      if (!done && value) {
        pq.enqueue({
          txn: value,
          gen,
        })
      }
    }

    const batch: AuxiliaryIndexTransaction[] = []
    while (!pq.isEmpty()) {
      const dequeued = pq.dequeue()
      if (!dequeued) {
        break
      }
      const { txn, gen } = dequeued
      const transactionTimeRange = filterOptions.transactionTimeRange24hr
      if (
        !transactionTimeRange ||
        (txn.timestamp &&
          transactionTimeRangeRuleFilterPredicate(
            txn.timestamp,
            transactionTimeRange
          ))
      ) {
        batch.push(
          omit(txn, [
            'PartitionKeyID',
            'SortKeyID',
          ]) as AuxiliaryIndexTransaction
        )
      }

      // Refill from the generator if it has more
      const { value, done } = await gen.next()
      if (!done && value) {
        pq.enqueue({
          txn: value as AuxiliaryIndexTransaction & { SortKeyID: string },
          gen,
        })
      }

      // Yield in pages
      if (batch.length >= 25) {
        yield batch.splice(0, batch.length)
      }
    }

    if (batch.length > 0) {
      yield batch
    }
  }

  private async *getDynamoDBTransactionsGeneratorByAddress(
    partitionKeyId: string,
    filterOptions: NonUserTransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    const queryInput = this.getNonUserTransactionFilterQueryInput(
      partitionKeyId,
      {
        afterTimestamp: filterOptions.afterTimestamp,
        beforeTimestamp: Date.now(),
        originAddress: filterOptions.originAddress,
        destinationAddress: filterOptions.destinationAddress,
      },
      attributesToFetch
    )
    const generator = paginateQueryGenerator(this.dynamoDb, queryInput)

    for await (const data of generator) {
      const transactions = (data.Items?.map((item) =>
        omit(item, ['PartitionKeyID', 'SortKeyID'])
      ) || []) as Array<AuxiliaryIndexTransaction>
      yield transactions
    }
  }

  private async getUserTransactionsCount(
    partitionKeyId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const partitionKeys = getAllBucketedPartitionKeys(
      partitionKeyId,
      AUXILLARY_TXN_PARTITION_COUNT
    )
    const result = await Promise.all(
      partitionKeys.map((key) =>
        paginateQuery(this.dynamoDb, {
          ...this.getTransactionsQuery(key, timeRange, filterOptions, []),
          Select: 'COUNT',
        })
      )
    )
    return result.reduce(
      (total, curr) => total + (curr?.Count ?? 0),
      0
    ) as number
  }

  private getNonUserTransactionFilterQueryInput(
    partitionKeyId: string,
    filterOptions: NonUserTransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): QueryCommandInput {
    // Only address filtering for non-user transactions
    const entityFilterExpressions: string[] = []
    const entityParams: [string, any][] = []

    // Handle origin address filtering
    if (filterOptions.originAddress) {
      const originAddressFilters = this.createAddressSpecificFilterExpressions(
        filterOptions.originAddress,
        'origin'
      )

      if (originAddressFilters.expressions.length > 0) {
        entityFilterExpressions.push(
          originAddressFilters.expressions.join(' AND ')
        )
        entityParams.push(...originAddressFilters.params)
      }
    }

    // Handle destination address filtering
    if (filterOptions.destinationAddress) {
      const destinationAddressFilters =
        this.createAddressSpecificFilterExpressions(
          filterOptions.destinationAddress,
          'destination'
        )

      if (destinationAddressFilters.expressions.length > 0) {
        entityFilterExpressions.push(
          destinationAddressFilters.expressions.join(' AND ')
        )
        entityParams.push(...destinationAddressFilters.params)
      }
    }

    if (filterOptions.originName) {
      const originNameFilters = this.createNameSpecificFilterExpressions(
        filterOptions.originName,
        'origin'
      )

      if (originNameFilters.expressions.length > 0) {
        entityFilterExpressions.push(
          originNameFilters.expressions.join(' AND ')
        )
        entityParams.push(...originNameFilters.params)
      }
    }

    if (filterOptions.destinationName) {
      const destinationNameFilters = this.createNameSpecificFilterExpressions(
        filterOptions.destinationName,
        'destination'
      )

      if (destinationNameFilters.expressions.length > 0) {
        entityFilterExpressions.push(
          destinationNameFilters.expressions.join(' AND ')
        )
        entityParams.push(...destinationNameFilters.params)
      }
    }

    if (filterOptions.originEmail) {
      const originEmailFilters = this.createEmailSpecificFilterExpressions(
        filterOptions.originEmail,
        'origin'
      )

      if (originEmailFilters.expressions.length > 0) {
        entityFilterExpressions.push(
          originEmailFilters.expressions.join(' AND ')
        )
        entityParams.push(...originEmailFilters.params)
      }
    }

    if (filterOptions.destinationEmail) {
      const destinationEmailFilters = this.createEmailSpecificFilterExpressions(
        filterOptions.destinationEmail,
        'destination'
      )

      if (destinationEmailFilters.expressions.length > 0) {
        entityFilterExpressions.push(
          destinationEmailFilters.expressions.join(' AND ')
        )
        entityParams.push(...destinationEmailFilters.params)
      }
    }

    const beforeTimestampFilterExpression = `#timestamp BETWEEN :afterTimestamp AND :beforeTimestamp`
    const beforeTimestampParams: [string, any][] = [
      [`:afterTimestamp`, filterOptions.afterTimestamp],
      [`:beforeTimestamp`, filterOptions.beforeTimestamp],
    ]

    // Partition key id filter
    const partitionKeyFilterExpression = `#partitionKeyID = :partitionKeyID`
    const partitionKeyParams: [string, any][] = [
      [':partitionKeyID', partitionKeyId],
    ]

    // Combine all filter expressions
    const allFilterExpressions = [
      ...entityFilterExpressions,
      beforeTimestampFilterExpression,
    ]

    const filterExpression = allFilterExpressions.join(' AND ')

    // Build expression attribute names based on what's actually used
    const expressionAttributeNames: Record<string, string> = {
      '#partitionKeyID': 'PartitionKeyID',
      '#timestamp': 'timestamp',
    }

    // Add address-related attribute names if address filters are present
    if (entityFilterExpressions.length > 0) {
      const baseAddressAttributeNames = {
        '#address': 'address',
        '#shippingAddress': 'shippingAddress',
        '#bankAddress': 'bankAddress',
        '#addressLines': 'addressLines',
        '#postcode': 'postcode',
        '#city': 'city',
        '#state': 'state',
        '#country': 'country',
      }

      // Only add the payment details attribute names that are actually used
      if (filterOptions.originAddress) {
        Object.assign(expressionAttributeNames, {
          '#originPaymentDetails': 'originPaymentDetails',
          ...baseAddressAttributeNames,
        })
      }
      if (filterOptions.destinationAddress) {
        Object.assign(expressionAttributeNames, {
          '#destinationPaymentDetails': 'destinationPaymentDetails',
          ...baseAddressAttributeNames,
        })
      }
    }

    // Implement attributes to fetch
    let projectionExpression: string | undefined = undefined
    if (attributesToFetch && attributesToFetch.length > 0) {
      // Always include timestamp for filtering
      const attributes = new Set(attributesToFetch)
      attributes.add('timestamp')
      // Build ProjectionExpression and update ExpressionAttributeNames
      projectionExpression = Array.from(attributes)
        .map((name) => `#${name}`)
        .join(', ')
      for (const name of attributes) {
        if (!expressionAttributeNames[`#${name}`]) {
          expressionAttributeNames[`#${name}`] = name as string
        }
      }
    }

    return {
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      KeyConditionExpression: partitionKeyFilterExpression,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: Object.fromEntries([
        ...partitionKeyParams,
        ...entityParams,
        ...beforeTimestampParams,
      ]),
      ...(projectionExpression
        ? { ProjectionExpression: projectionExpression }
        : {}),
    }
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
        : attributesToFetch
            .map((name) => `#${name}`)
            .join(', ')
            .concat(', SortKeyID'), // As we require to sort page results for multiple partitionKeyID
    }
  }

  /**
   * Creates address filter expressions specific to origin or destination payment details
   * Uses DynamoDB transaction partition key structure for efficient filtering
   */
  private createAddressSpecificFilterExpressions(
    addressFilter: Address | undefined,
    direction: 'origin' | 'destination'
  ): { expressions: string[]; params: [string, any][] } {
    const expressions: string[] = []
    const params: [string, any][] = []

    if (!addressFilter) {
      return { expressions, params }
    }

    // Unified address fields without payment method filtering
    const addressFields = ['address', 'shippingAddress', 'bankAddress']

    // Build expressions for each address field, combining all address components with AND
    const fieldExpressions = addressFields
      .map((field) => {
        const fieldConditions: string[] = []

        if (
          addressFilter.addressLines &&
          addressFilter.addressLines.length > 0
        ) {
          addressFilter.addressLines.forEach((line: string, index: number) => {
            if (line) {
              params.push([`:${direction}AddressLine${index}`, line])
              fieldConditions.push(
                `#${direction}PaymentDetails.#${field}.#addressLines[${index}] = :${direction}AddressLine${index}`
              )
            }
          })
        }

        if (addressFilter.postcode) {
          params.push([`:${direction}Postcode`, addressFilter.postcode])
          fieldConditions.push(
            `#${direction}PaymentDetails.#${field}.#postcode = :${direction}Postcode`
          )
        }

        if (addressFilter.city) {
          params.push([`:${direction}City`, addressFilter.city])
          fieldConditions.push(
            `#${direction}PaymentDetails.#${field}.#city = :${direction}City`
          )
        }

        if (addressFilter.state) {
          params.push([`:${direction}State`, addressFilter.state])
          fieldConditions.push(
            `#${direction}PaymentDetails.#${field}.#state = :${direction}State`
          )
        }

        if (addressFilter.country) {
          params.push([`:${direction}Country`, addressFilter.country])
          fieldConditions.push(
            `#${direction}PaymentDetails.#${field}.#country = :${direction}Country`
          )
        }

        return fieldConditions.length > 0
          ? `(${fieldConditions.join(' AND ')})`
          : null
      })
      .filter(Boolean)

    if (fieldExpressions.length > 0) {
      expressions.push(`(${fieldExpressions.join(' OR ')})`)
    }

    return { expressions, params }
  }

  private createNameSpecificFilterExpressions(
    nameFilter: string | ConsumerName | undefined,
    direction: 'origin' | 'destination'
  ): { expressions: string[]; params: [string, any][] } {
    const expressions: string[] = []
    const params: [string, any][] = []

    if (!nameFilter) {
      return { expressions, params }
    }

    if (typeof nameFilter === 'string') {
      params.push([`:${direction}Name`, nameFilter])
      expressions.push(`#${direction}PaymentDetails.#name = :${direction}Name`)
    } else {
      const fields = ['nameOnCard', 'name']
      const fieldExpressions = fields.map((field) => {
        return [
          `#${direction}PaymentDetails.#${field}.#firstName = :${direction}Name`,
          `#${direction}PaymentDetails.#${field}.#middleName = :${direction}Name`,
          `#${direction}PaymentDetails.#${field}.#lastName = :${direction}Name`,
        ].join(' AND ')
      })
      expressions.push(`(${fieldExpressions.join(' OR ')})`)
    }

    return { expressions, params }
  }

  private createEmailSpecificFilterExpressions(
    emailFilter: string | undefined,
    direction: 'origin' | 'destination'
  ): { expressions: string[]; params: [string, any][] } {
    const expressions: string[] = []
    const params: [string, any][] = []

    if (!emailFilter) {
      return { expressions, params }
    }

    params.push([`:${direction}Email`, emailFilter])
    expressions.push(
      `#${direction}PaymentDetails.#emailId = :${direction}Email`
    )

    return { expressions, params }
  }

  private getTransactionsGeneratorByEntity(
    entity: NonUserEntityData | undefined,
    timeRange: TimeRange,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    direction: 'origin' | 'destination'
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    if (!entity) {
      return (async function* () {
        yield []
      })()
    }

    // For DynamoDB, we use the existing non-user transaction methods
    // and the address filtering is handled in the getTransactionFilterQueryInput method
    // which will apply the address filter from filterOptions.originAddress or filterOptions.destinationAddress
    // The address filter will automatically check all relevant address fields based on payment method
    const filterOptions: NonUserTransactionsFilterOptions = {
      originAddress:
        direction === 'origin' && entity?.type === 'ADDRESS'
          ? entity.address
          : undefined,
      destinationAddress:
        direction === 'destination' && entity?.type === 'ADDRESS'
          ? entity.address
          : undefined,
      originEmail:
        direction === 'origin' && entity?.type === 'EMAIL'
          ? entity.email
          : undefined,
      destinationEmail:
        direction === 'destination' && entity?.type === 'EMAIL'
          ? entity.email
          : undefined,
      originName:
        direction === 'origin' && entity?.type === 'NAME'
          ? entity.name
          : undefined,
      destinationName:
        direction === 'destination' && entity?.type === 'NAME'
          ? entity.name
          : undefined,
      beforeTimestamp: timeRange.beforeTimestamp,
      afterTimestamp: timeRange.afterTimestamp,
    }

    const finalAttributesToFetch: Array<keyof AuxiliaryIndexTransaction> = [
      ...attributesToFetch,
      'originPaymentDetails',
      'destinationPaymentDetails',
    ]

    if (direction === 'origin') {
      return this.getDynamoDBTransactionsGeneratorByAddress(
        DynamoDbKeys.TRANSACTION(this.tenantId).PartitionKeyID,
        filterOptions,
        finalAttributesToFetch
      )
    } else {
      return this.getDynamoDBTransactionsGeneratorByAddress(
        DynamoDbKeys.TRANSACTION(this.tenantId).PartitionKeyID,
        filterOptions,
        finalAttributesToFetch
      )
    }
  }

  public getNonUserSendingTransactionsGeneratorByEntity(
    entity: NonUserEntityData | undefined,
    timeRange: TimeRange,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    return this.getTransactionsGeneratorByEntity(
      entity,
      timeRange,
      attributesToFetch,
      'origin'
    )
  }

  public getNonUserReceivingTransactionsGeneratorByEntity(
    entity: NonUserEntityData | undefined,
    timeRange: TimeRange,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    return this.getTransactionsGeneratorByEntity(
      entity,
      timeRange,
      attributesToFetch,
      'destination'
    )
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
  transactionTypes: string[] | undefined
): (string | undefined)[] {
  return transactionTypes && !isEmpty(transactionTypes)
    ? compact(transactionTypes)
    : [undefined]
}
