import { v4 as uuidv4 } from 'uuid'
import { AggregationCursor, Document, Filter, MongoClient } from 'mongodb'
import _, { chunk } from 'lodash'
import { StackConstants } from '@cdk/constants'
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
import { Transaction } from '@/@types/openapi-public/Transaction'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { getTimestampBasedIDPrefix } from '@/utils/timestampUtils'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Tag } from '@/@types/openapi-public/Tag'
import {
  paginateFindOptions,
  paginatePipeline,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  prefixRegexMatchFilter,
} from '@/utils/mongoDBUtils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { TransactionStatusChange } from '@/@types/openapi-internal/TransactionStatusChange'
import { paginateQuery } from '@/utils/dynamodb'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { HitRulesDetails } from '@/@types/openapi-public/HitRulesDetails'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { Currency, getCurrencyExchangeRate } from '@/utils/currency-utils'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import dayjs, { duration } from '@/utils/dayjs'
import { getTimeLabels } from '@/lambdas/console-api-dashboard/utils'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'
import { neverThrow } from '@/utils/lang'
import { OptionalPagination, COUNT_QUERY_LIMIT } from '@/utils/pagination'

type QueryCountResult = { count: number; scannedCount: number }
type TimeRange = {
  beforeTimestamp: number // exclusive
  afterTimestamp: number // inclusive
}

export type AuxiliaryIndexTransaction = Partial<Transaction> & {
  senderKeyId?: string
  receiverKeyId?: string
}
export type TransactionsFilterOptions = {
  transactionTypes?: TransactionType[]
  transactionStates?: TransactionState[]
  senderKeyId?: string
  receiverKeyId?: string
  originPaymentMethod?: PaymentMethod
  destinationPaymentMethod?: PaymentMethod
  originCountries?: string[]
  destinationCountries?: string[]
}

export function getNewTransactionID(transaction: Transaction) {
  return (
    transaction.transactionId ||
    `${getTimestampBasedIDPrefix(transaction.timestamp)}-${uuidv4()}`
  )
}

export class TransactionRepository {
  dynamoDb: DynamoDBDocumentClient
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      dynamoDb?: DynamoDBDocumentClient
      mongoDb?: MongoClient
    }
  ) {
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  static getAggregatedRuleStatus(
    ruleActions: ReadonlyArray<RuleAction>
  ): RuleAction {
    return ruleActions.reduce((prev, curr) => {
      if (RULE_ACTIONS.indexOf(curr) < RULE_ACTIONS.indexOf(prev)) {
        return curr
      } else {
        return prev
      }
    }, 'ALLOW')
  }

  /* MongoDB operations */

  async addTransactionToMongo(
    transaction: TransactionWithRulesResult
  ): Promise<TransactionCaseManagement> {
    const db = this.mongoDb.db()
    const transactionsCollection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const transactionCaseManagement: TransactionCaseManagement = {
      ...transaction,
      status: TransactionRepository.getAggregatedRuleStatus(
        transaction.executedRules
          .filter((rule) => rule.ruleHit)
          .map((rule) => rule.ruleAction)
      ),
    }
    await transactionsCollection.replaceOne(
      { transactionId: transaction.transactionId },
      transactionCaseManagement,
      { upsert: true }
    )
    return transactionCaseManagement
  }

  public getTransactionsMongoQuery(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Filter<TransactionCaseManagement> {
    const conditions: Filter<TransactionCaseManagement>[] = []
    conditions.push({
      timestamp: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      },
    })
    if (params.filterIdList != null) {
      conditions.push({
        transactionId: { $in: params.filterIdList },
      })
    }
    if (params.filterId != null) {
      conditions.push({
        transactionId: prefixRegexMatchFilter(params.filterId),
      })
    }
    if (params.transactionType != null) {
      conditions.push({
        type: prefixRegexMatchFilter(params.transactionType),
      })
    }
    if (params.filterOutStatus != null) {
      conditions.push({ status: { $ne: params.filterOutStatus } })
    }
    if (params.filterOutCaseStatus != null) {
      conditions.push({ caseStatus: { $ne: params.filterOutCaseStatus } })
    }
    if (params.filterTransactionState != null) {
      conditions.push({
        transactionState: { $in: params.filterTransactionState },
      })
    }
    if (params.filterStatus != null) {
      conditions.push({ status: { $in: params.filterStatus } })
    }
    if (params.filterCaseStatus != null) {
      conditions.push({ caseStatus: { $eq: params.filterCaseStatus } })
    }
    if (params.filterUserId != null) {
      conditions.push({
        $or: [
          { originUserId: { $eq: params.filterUserId } },
          { destinationUserId: { $eq: params.filterUserId } },
        ],
      })
    } else {
      if (params.filterOriginUserId != null) {
        conditions.push({ originUserId: { $eq: params.filterOriginUserId } })
      }
      if (params.filterDestinationUserId != null) {
        conditions.push({
          destinationUserId: {
            $eq: params.filterDestinationUserId,
          },
        })
      }
    }

    const executedRulesFilters = []
    if (params.filterRulesExecuted != null) {
      executedRulesFilters.push({
        $elemMatch: { ruleId: { $in: params.filterRulesExecuted } },
      })
    }
    if (params.filterRulesHit != null) {
      executedRulesFilters.push({
        $elemMatch: {
          ruleHit: true,
          ruleId: { $in: params.filterRulesHit },
        },
      })
    }
    if (params.filterRuleInstancesHit?.length ?? 0 > 0) {
      executedRulesFilters.push({
        $elemMatch: {
          ruleHit: true,
          ruleInstanceId: { $in: params.filterRuleInstancesHit },
        },
      })
    }

    if (executedRulesFilters.length > 0) {
      conditions.push({
        executedRules: {
          $all: executedRulesFilters,
        },
      })
    }

    if (params.filterOriginCurrencies != null) {
      conditions.push({
        'originAmountDetails.transactionCurrency': {
          $in: params.filterOriginCurrencies,
        },
      })
    }
    if (params.filterDestinationCurrencies != null) {
      conditions.push({
        'destinationAmountDetails.transactionCurrency': {
          $in: params.filterDestinationCurrencies,
        },
      })
    }
    if (params.filterOriginPaymentMethod != null) {
      conditions.push({
        'originPaymentDetails.method': {
          $eq: params.filterOriginPaymentMethod,
        },
      })
    }
    if (params.filterDestinationPaymentMethod != null) {
      conditions.push({
        'destinationPaymentDetails.method': {
          $eq: params.filterDestinationPaymentMethod,
        },
      })
    }
    if (params.filterTagKey || params.filterTagValue) {
      const elemCondition: { [attr: string]: Filter<Tag> } = {}
      if (params.filterTagKey) {
        elemCondition['key'] = { $eq: params.filterTagKey }
      }
      if (params.filterTagValue) {
        elemCondition['value'] = prefixRegexMatchFilter(params.filterTagValue)
      }
      conditions.push({
        tags: {
          $elemMatch: elemCondition,
        },
      })
    }

    return { $and: conditions }
  }

  public getTransactionsCursor(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): AggregationCursor<TransactionCaseManagement> {
    const query = this.getTransactionsMongoQuery(params)
    return this.getDenormalizedTransactions(query, params)
  }

  private getDenormalizedTransactions(
    query: Filter<TransactionCaseManagement>,
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ) {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<TransactionCaseManagement>(name)
    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'timestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const pipeline: Document[] = [{ $match: query }]

    if (sortField === 'ruleHitCount') {
      pipeline.push(
        {
          $addFields: {
            Hit: { $size: '$hitRules' },
          },
        },
        { $sort: { Hit: sortOrder } }
      )
    } else {
      pipeline.push({ $sort: { [sortField]: sortOrder } })
    }
    pipeline.push(...paginatePipeline(params))
    if (params?.includeUsers) {
      pipeline.push(
        ...[
          {
            $lookup: {
              from: USERS_COLLECTION(this.tenantId),
              localField: 'originUserId',
              foreignField: 'userId',
              as: 'originUser',
            },
          },
          {
            $lookup: {
              from: USERS_COLLECTION(this.tenantId),
              localField: 'destinationUserId',
              foreignField: 'userId',
              as: 'destinationUser',
            },
          },
          {
            $set: {
              originUser: { $first: '$originUser' },
              destinationUser: { $first: '$destinationUser' },
            },
          },
        ]
      )
    }
    if (params?.includeEvents) {
      pipeline.push(
        ...[
          {
            $lookup: {
              from: TRANSACTION_EVENTS_COLLECTION(this.tenantId),
              localField: 'transactionId',
              foreignField: 'transactionId',
              let: {
                eventTransactionId: '$transactionId',
              },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$transactionId', '$$eventTransactionId'] },
                  },
                },
                {
                  $sort: { timestamp: 1 },
                },
              ],
              as: 'events',
            },
          },
        ]
      )
    }
    return collection.aggregate<TransactionCaseManagement>(pipeline)
  }

  public async getTransactionsCount(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const query = this.getTransactionsMongoQuery(params)
    return collection.countDocuments(query, {
      limit: COUNT_QUERY_LIMIT,
    })
  }

  public async getTransactions(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<{ total: number; data: TransactionCaseManagement[] }> {
    const cursor = await this.getTransactionsCursor(params)
    const total = await this.getTransactionsCount(params)
    return { total, data: await cursor.toArray() }
  }

  public async updateTransactionsCaseManagement(
    transactionIds: string[],
    updates: {
      assignments?: Assignment[]
      status?: RuleAction
      statusChange?: TransactionStatusChange
      caseStatus?: CaseStatus
    }
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    await collection.updateMany(
      { transactionId: { $in: transactionIds } },
      {
        $set: _.omitBy<Partial<TransactionCaseManagement>>(
          {
            assignments: updates.assignments,
            status: updates.status,
            caseStatus: updates.caseStatus,
          },
          _.isNil
        ),
        ...(updates.statusChange
          ? { $push: { statusChanges: updates.statusChange } }
          : {}),
      }
    )
  }

  public async getTransactionCaseManagement(
    transactionId: string
  ): Promise<TransactionCaseManagement | null> {
    return (
      await this.getDenormalizedTransactions(
        {
          transactionId,
        },
        {
          includeUsers: true,
          includeEvents: true,
          beforeTimestamp: Date.now(),
        }
      )
    ).next()
  }

  public async saveTransactionComment(
    transactionId: string,
    comment: Comment
  ): Promise<Comment> {
    const db = this.mongoDb.db()
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const commentToSave: Comment = {
      ...comment,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await collection.updateOne(
      {
        transactionId,
      },
      {
        $push: { comments: commentToSave },
      }
    )
    return commentToSave
  }

  public async deleteTransactionComment(
    transactionId: string,
    commentId: string
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    await collection.updateOne(
      {
        transactionId,
      },
      {
        $pull: { comments: { id: commentId } },
      }
    )
  }

  public async getTransactionCaseManagementById(
    transactionId: string
  ): Promise<TransactionCaseManagement | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<TransactionCaseManagement>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    return collection.findOne<TransactionCaseManagement>({ transactionId })
  }

  /* DynamoDB operations */

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

    if (process.env.NODE_ENV === 'development') {
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
      ? (
          await this.getUserSendingTransactionsCount(
            userId,
            timeRange,
            filterOptions
          )
        ).count
      : paymentDetails
      ? (
          await this.getNonUserSendingTransactionsCount(
            paymentDetails,
            timeRange,
            filterOptions
          )
        ).count
      : 0
  }

  public async getGenericUserReceivingTransactionsCount(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ) {
    return userId
      ? (
          await this.getUserReceivingTransactionsCount(
            userId,
            timeRange,
            filterOptions
          )
        ).count
      : paymentDetails
      ? (
          await this.getNonUserReceivingTransactionsCount(
            paymentDetails,
            timeRange,
            filterOptions
          )
        ).count
      : 0
  }

  public async getUserSendingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<QueryCountResult> {
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
    return results.reduce(
      (prev, curr) => ({
        count: prev.count + curr.count,
        scannedCount: prev.scannedCount + curr.scannedCount,
      }),
      {
        count: 0,
        scannedCount: 0,
      }
    )
  }

  public async getUserReceivingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<QueryCountResult> {
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
    return results.reduce(
      (prev, curr) => ({
        count: prev.count + curr.count,
        scannedCount: prev.scannedCount + curr.scannedCount,
      }),
      {
        count: 0,
        scannedCount: 0,
      }
    )
  }

  public async getNonUserSendingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<QueryCountResult> {
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
    return results.reduce(
      (prev, curr) => ({
        count: prev.count + curr.count,
        scannedCount: prev.scannedCount + curr.scannedCount,
      }),
      {
        count: 0,
        scannedCount: 0,
      }
    )
  }

  public async getNonUserReceivingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<QueryCountResult> {
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
    return results.reduce(
      (prev, curr) => ({
        count: prev.count + curr.count,
        scannedCount: prev.scannedCount + curr.scannedCount,
      }),
      {
        count: 0,
        scannedCount: 0,
      }
    )
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
  ): Promise<QueryCountResult> {
    const result = await paginateQuery(this.dynamoDb, {
      ...this.getTransactionsQuery(
        partitionKeyId,
        timeRange,
        filterOptions,
        []
      ),
      Select: 'COUNT',
    })
    return {
      count: result.Count as number,
      scannedCount: result.ScannedCount as number,
    }
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
      filterOptions.receiverKeyId && 'receiverKeyId = :receiverKeyId',
      filterOptions.senderKeyId && 'senderKeyId = :senderKeyId',
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
            ':senderKeyId': filterOptions.senderKeyId,
            ':receiverKeyId': filterOptions.receiverKeyId,
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

  public async getUniques(params: {
    field: TransactionsUniquesField
    filter?: string
  }): Promise<string[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<TransactionCaseManagement>(name)

    let fieldPath: string
    const filterConditions = []
    switch (params.field) {
      case 'TRANSACTION_STATE':
        fieldPath = 'transactionState'
        break
      case 'TAGS_KEY':
        fieldPath = 'tags.key'
        break
      case 'IBAN_NUMBER':
        fieldPath = 'originPaymentDetails.IBAN'
        filterConditions.push({
          'originPaymentDetails.method': 'IBAN',
        })
        break
      case 'CARD_FINGERPRINT_NUMBER':
        fieldPath = 'originPaymentDetails.cardFingerprint'
        filterConditions.push({
          'originPaymentDetails.method': 'CARD',
        })
        break
      case 'BANK_ACCOUNT_NUMBER':
        fieldPath = 'originPaymentDetails.accountNumber'
        filterConditions.push({
          'originPaymentDetails.method': 'GENERIC_BANK_ACCOUNT',
        })
        break
      case 'ACH_ACCOUNT_NUMBER':
        fieldPath = 'originPaymentDetails.accountNumber'
        filterConditions.push({
          'originPaymentDetails.method': 'ACH',
        })
        break
      case 'SWIFT_ACCOUNT_NUMBER':
        fieldPath = 'originPaymentDetails.accountNumber'
        filterConditions.push({
          'originPaymentDetails.method': 'SWIFT',
        })
        break
      case 'BIC':
        fieldPath = 'originPaymentDetails.BIC'
        filterConditions.push({
          'originPaymentDetails.method': 'IBAN',
        })
        break
      case 'BANK_SWIFT_CODE':
        fieldPath = 'originPaymentDetails.swiftCode'
        filterConditions.push({
          'originPaymentDetails.method': 'SWIFT',
        })
        break
      case 'UPI_IDENTIFYING_NUMBER':
        fieldPath = 'originPaymentDetails.upiID'
        filterConditions.push({
          'originPaymentDetails.method': 'UPI',
        })
        break
      case 'IP_ADDRESS':
        fieldPath = 'deviceData.ipAddress'
        break
      default:
        throw neverThrow(params.field, `Unknown field: ${params.field}`)
    }

    if (params.filter) {
      filterConditions.push({
        [fieldPath]: prefixRegexMatchFilter(params.filter),
      })
    }

    const pipeline: Document[] = [
      filterConditions.length > 0
        ? {
            $match: {
              $and: filterConditions,
            },
          }
        : {},
      // If we have filter conditions, it's for auto-complete. It's acceptable that
      // we don't filter all the documents for performance concerns.
      filterConditions.length > 0 ? { $limit: 10000 } : {},
      {
        $group: {
          _id: `$${fieldPath}`,
        },
      },
      {
        $limit: 100,
      },
    ].filter((stage) => !_.isEmpty(stage))

    const result: string[] = await collection
      .aggregate<{ _id: string }>(pipeline)
      .map(({ _id }) => _id)
      .toArray()
    return result
  }
  public async getStatsByType(
    params: DefaultApiGetTransactionsListRequest,
    referenceCurrency: Currency
  ): Promise<TransactionsStatsByTypesResponse['data']> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<TransactionCaseManagement>(name)
    const query = this.getTransactionsMongoQuery(params)

    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'timestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const result: {
      [key in TransactionType | 'null']?: {
        amounts: number[]
        min: number | null
        max: number | null
      }
    } = {}

    const cursor = await collection.find(query, {
      sort: { [sortField]: sortOrder },
      ...paginateFindOptions(params),
    })
    for await (const next of cursor) {
      const transactionType = next.type ?? 'null'
      const acc = result[transactionType] ?? {
        amounts: [],
        min: null,
        max: null,
      }
      result[transactionType] = acc
      const amount = await this.getAmount(next, referenceCurrency)
      acc.amounts.push(amount)
      acc.min = acc.min != null ? Math.min(acc.min, amount) : amount
      acc.max = acc.max != null ? Math.max(acc.max, amount) : amount
    }

    return Object.entries(result).map(([transactionType, acc]) => {
      const amounts = acc.amounts
      amounts.sort((x, y) => x - y)
      const count = amounts.length
      const sum = amounts.reduce((acc: number, x) => acc + (x ?? 0), 0)
      return {
        transactionType:
          transactionType === 'null'
            ? undefined
            : (transactionType as TransactionType),
        count,
        sum,
        average: (sum / count || 0) ?? undefined,
        min: acc.min ?? undefined,
        max: acc.max ?? undefined,
        median:
          (count % 2 === 1
            ? amounts[(count - 1) / 2]
            : (amounts[count / 2] + amounts[count / 2 - 1]) / 2) || undefined,
      }
    })
  }

  public async getStatsByTime(
    params: DefaultApiGetTransactionsListRequest,
    referenceCurrency: Currency
  ): Promise<TransactionsStatsByTimeResponse['data']> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<TransactionCaseManagement>(name)
    const query = this.getTransactionsMongoQuery({
      ...params,
    })

    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'timestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const minMaxPipeline: Document[] = []
    minMaxPipeline.push({ $match: query })
    minMaxPipeline.push({ $sort: { [sortField]: sortOrder } })
    minMaxPipeline.push(...paginatePipeline(params))
    minMaxPipeline.push({
      $group: {
        _id: '_id',
        oldest: {
          $min: '$timestamp',
        },
        youngest: {
          $max: '$timestamp',
        },
      },
    })
    const minMax = await collection
      .aggregate<{ oldest: number; youngest: number }>(minMaxPipeline)
      .next()
    if (minMax == null) {
      return []
    }
    const { oldest, youngest } = minMax

    const difference = youngest - oldest

    let seriesFormat: string
    let labelFormat: string
    let granularity: 'HOUR' | 'DAY' | 'MONTH'
    const dur = duration(difference)
    if (dur.asMonths() > 1) {
      seriesFormat = 'YYYY/MM/01 00:00 Z'
      labelFormat = 'YYYY/MM'
      granularity = 'MONTH'
    } else if (dur.asDays() > 1) {
      seriesFormat = 'YYYY/MM/DD 00:00 Z'
      labelFormat = 'MM/DD'
      granularity = 'DAY'
    } else {
      seriesFormat = 'YYYY/MM/DD HH:00 Z'
      labelFormat = 'HH:mm'
      granularity = 'HOUR'
    }

    const result: TransactionsStatsByTimeResponse['data'] = getTimeLabels(
      seriesFormat,
      oldest,
      youngest,
      granularity
    ).map((series) => ({
      series: series,
      label: dayjs(series, seriesFormat).format(labelFormat),
      values: {},
    }))

    const transactionsCursor = collection.find(query, {
      sort: { [sortField]: sortOrder },
      ...paginateFindOptions(params),
    })
    for await (const transaction of transactionsCursor) {
      if (transaction.timestamp) {
        const series = dayjs(transaction.timestamp).format(seriesFormat)
        const label = dayjs(transaction.timestamp).format(labelFormat)
        const amount = await this.getAmount(transaction, referenceCurrency)

        let counters = result.find((x) => x.series === series)
        if (counters == null) {
          counters = {
            series,
            label,
            values: {},
          }
          result.push(counters)
        }

        const ruleActionCounter = counters.values[transaction.status] ?? {
          count: 0,
          amount: 0,
        }
        counters.values[transaction.status] = ruleActionCounter

        ruleActionCounter.count = ruleActionCounter.count + 1
        ruleActionCounter.amount = ruleActionCounter.amount + amount
      }
    }

    return result
  }

  private async getAmount(
    transaction: TransactionCaseManagement,
    referenceCurrency: Currency
  ): Promise<number> {
    let amount = 0
    if (transaction.originAmountDetails != null) {
      if (
        transaction.originAmountDetails.transactionCurrency != referenceCurrency
      ) {
        const exchangeRate = await getCurrencyExchangeRate(
          transaction.originAmountDetails.transactionCurrency,
          referenceCurrency
        )
        amount =
          transaction.originAmountDetails.transactionAmount * exchangeRate
      } else {
        amount = transaction.originAmountDetails.transactionAmount
      }
    }
    return amount
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
