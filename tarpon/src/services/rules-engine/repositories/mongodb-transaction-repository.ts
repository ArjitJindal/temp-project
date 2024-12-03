import {
  AggregationCursor,
  ClientSession,
  Document,
  Filter,
  FindCursor,
  MongoClient,
} from 'mongodb'
import {
  compact,
  difference,
  isEmpty,
  isNil,
  keyBy,
  mapKeys,
  mapValues,
  omitBy,
  pick,
  uniq,
} from 'lodash'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import dayjsLib from '@flagright/lib/utils/dayjs'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import { transactionTimeRangeRuleFilterPredicate } from '../transaction-filters/utils/helpers'
import { filterOutInternalRules } from '../pnb-custom-logic'
import {
  AuxiliaryIndexTransaction,
  RulesEngineTransactionRepositoryInterface,
  TimeRange,
  TransactionsFilterOptions,
} from './transaction-repository-interface'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Tag } from '@/@types/openapi-public/Tag'
import {
  DAY_DATE_FORMAT,
  getMongoDbClient,
  internalMongoUpdateOne,
  lookupPipelineStage,
  paginateCursor,
  paginateFindOptions,
  paginatePipeline,
  prefixRegexMatchFilter,
} from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  UNIQUE_TAGS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import { duration } from '@/utils/dayjs'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'
import { neverThrow } from '@/utils/lang'
import {
  COUNT_QUERY_LIMIT,
  cursorPaginate,
  CursorPaginationResponse,
  OptionalPagination,
  OptionalPaginationParams,
} from '@/utils/pagination'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import {
  getPaymentDetailsIdentifiers,
  getPaymentMethodId,
  PAYMENT_METHOD_IDENTIFIER_FIELDS,
} from '@/core/dynamodb/dynamodb-keys'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { traceable } from '@/core/xray'
import { Currency, CurrencyService } from '@/services/currency'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { UserTag } from '@/@types/openapi-internal/UserTag'

const INTERNAL_ONLY_TRANSACTION_ATTRIBUTES = difference(
  InternalTransaction.getAttributeTypeMap().map((v) => v.name),
  uniq(TransactionWithRulesResult.getAttributeTypeMap().map((v) => v.name))
)

@traceable
export class MongoDbTransactionRepository
  implements RulesEngineTransactionRepositoryInterface
{
  mongoDb: MongoClient
  tenantId: string

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.mongoDb = mongoDb
    this.tenantId = tenantId
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()

    return new MongoDbTransactionRepository(tenantId, mongoDb)
  }

  async addTransactionToMongo(
    transaction: InternalTransaction,
    arsScore?: ArsScore,
    options?: { session?: ClientSession }
  ): Promise<InternalTransaction> {
    const internalTransaction: InternalTransaction = {
      ...transaction,
      originPaymentMethodId: getPaymentMethodId(
        transaction.originPaymentDetails
      ),
      destinationPaymentMethodId: getPaymentMethodId(
        transaction.destinationPaymentDetails
      ),
      ...(arsScore ? { arsScore } : {}),
      hitRules: filterOutInternalRules(transaction.hitRules),
      executedRules: filterOutInternalRules(transaction.executedRules),
    }

    const existingTransaction = await this.getTransactionById(
      transaction.transactionId
    )

    const now = Date.now()
    internalTransaction.createdAt = existingTransaction?.createdAt ?? now
    internalTransaction.updatedAt = now

    // TODO we are moving status to be populated in dynamo, however in the transition we may
    // process transactions without a status set.
    if (internalTransaction && !internalTransaction.status) {
      internalTransaction.status = getAggregatedRuleStatus(
        internalTransaction.hitRules.map((hr) => hr)
      )
    }

    const payload: InternalTransaction = {
      ...pick(internalTransaction, INTERNAL_ONLY_TRANSACTION_ATTRIBUTES),
      ...internalTransaction,
    }

    await Promise.all([
      internalMongoUpdateOne(
        this.mongoDb,
        TRANSACTIONS_COLLECTION(this.tenantId),
        { transactionId: transaction.transactionId },
        { $set: payload },
        { session: options?.session }
      ),
      this.updateUniqueTransactionTags(transaction),
    ])

    return internalTransaction
  }

  public async getTransactionById(
    transactionId: string
  ): Promise<InternalTransaction | null> {
    const db = this.mongoDb.db()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    const transaction = await transactionsCollection.findOne({
      transactionId,
    })

    return transaction
  }

  public getTransactionsMongoQuery(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>,
    additionalFilters: Filter<InternalTransaction>[] = []
  ): Filter<InternalTransaction> {
    const conditions: Filter<InternalTransaction>[] = additionalFilters

    if (params.filterDestinationCountries) {
      conditions.push({
        'destinationAmountDetails.country': {
          $in: params.filterDestinationCountries,
        },
      })
    }

    if (params.filterOriginCountries) {
      conditions.push({
        'originAmountDetails.country': {
          $in: params.filterOriginCountries,
        },
      })
    }

    if (params.alertId) {
      conditions.push({ alertIds: params.alertId })
    }

    if (params.afterTimestamp) {
      conditions.push({ timestamp: { $gte: params.afterTimestamp || 0 } })
    }
    if (params.beforeTimestamp) {
      conditions.push({
        timestamp: { $lt: params.beforeTimestamp || Number.MAX_SAFE_INTEGER },
      })
    }

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

    if (params.filterOriginPaymentMethodId != null) {
      conditions.push({
        originPaymentMethodId: prefixRegexMatchFilter(
          params.filterOriginPaymentMethodId
        ),
      })
    }

    if (params.filterDestinationPaymentMethodId != null) {
      conditions.push({
        destinationPaymentMethodId: prefixRegexMatchFilter(
          params.filterDestinationPaymentMethodId
        ),
      })
    }

    if (params.filterOutStatus != null) {
      conditions.push({ status: { $ne: params.filterOutStatus } })
    }
    if (params.filterOutCaseStatus != null) {
      conditions.push({
        caseStatus: { $nin: [params.filterOutCaseStatus] },
      })
    }
    if (params.filterTransactionState != null) {
      conditions.push({
        transactionState: { $in: params.filterTransactionState },
      })
    }
    if (params.filterTransactionTypes != null) {
      conditions.push({
        type: { $in: params.filterTransactionTypes },
      })
    }
    if (params.filterStatus != null) {
      conditions.push({ status: { $in: params.filterStatus } })
    }
    if (params.filterCaseStatus != null) {
      conditions.push({ caseStatus: { $in: [params.filterCaseStatus] } })
    }

    if (params.filterRulesExecuted != null) {
      conditions.push({
        executedRules: {
          $elemMatch: { ruleId: { $in: params.filterRulesExecuted } },
        },
      })
    }

    if (params.filterRuleInstancesExecuted != null) {
      conditions.push({
        executedRules: {
          $elemMatch: {
            ruleInstanceId: { $in: params.filterRuleInstancesExecuted },
          },
        },
      })
    }

    if (params.filterRulesHit != null) {
      conditions.push({
        hitRules: {
          $elemMatch: { ruleId: { $in: params.filterRulesHit } },
        },
      })
    }

    if (params.filterProductType != null) {
      conditions.push({
        productType: { $in: params.filterProductType },
      })
    }

    if (params.filterRuleInstancesHit?.length) {
      const eleMatchCondition = {
        ruleInstanceId: { $in: params.filterRuleInstancesHit },
      }
      if (params.filterShadowHit) {
        eleMatchCondition['isShadow'] = true
      } else {
        eleMatchCondition['isShadow'] = { $ne: true }
      }

      conditions.push({
        hitRules: {
          $elemMatch: eleMatchCondition,
        },
      })
    }

    if (
      params.filterTransactionStatus &&
      params.filterRuleInstancesHit?.length
    ) {
      const ruleInstanceId = params.filterRuleInstancesHit

      conditions.push({
        $or: [
          {
            executedRules: {
              $elemMatch: {
                ruleInstanceId: { $in: ruleInstanceId },
                ruleHit: true,
                ruleAction: { $in: params.filterTransactionStatus },
              },
            },
          },
          {
            $and: [
              {
                executedRules: {
                  $all: [
                    {
                      $elemMatch: {
                        ruleInstanceId: { $in: ruleInstanceId },
                        ruleHit: false,
                      },
                    },
                  ],
                },
              },
              { $expr: { $in: ['ALLOW', params.filterTransactionStatus] } },
            ],
          },
        ],
      })
    }

    if (params.filterOriginCountries != null) {
      conditions.push({
        'originAmountDetails.country': {
          $in: params.filterOriginCountries,
        },
      })
    }
    if (params.filterDestinationCountries != null) {
      conditions.push({
        'destinationAmountDetails.country': {
          $in: params.filterDestinationCountries,
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
    if (params.filterOriginPaymentMethods != null) {
      conditions.push({
        'originPaymentDetails.method': {
          $in: params.filterOriginPaymentMethods,
        },
      })
    }
    if (params.filterDestinationPaymentMethods != null) {
      conditions.push({
        'destinationPaymentDetails.method': {
          $in: params.filterDestinationPaymentMethods,
        },
      })
    }
    if (params.filterTagKey || params.filterTagValue) {
      const elemCondition: { [attr: string]: Filter<Tag | UserTag> } = {}
      if (params.filterTagKey) {
        elemCondition['key'] = { $in: [params.filterTagKey] }
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

    if (params.filterUserId) {
      conditions.push({
        $or: [
          {
            originUserId: { $in: [params.filterUserId] },
          },
          {
            destinationUserId: { $in: [params.filterUserId] },
          },
        ],
      })
    }

    if (params.filterOriginUserId) {
      conditions.push({
        originUserId: { $in: [params.filterOriginUserId] },
      })
    }

    if (params.filterDestinationUserId) {
      conditions.push({
        destinationUserId: { $in: [params.filterDestinationUserId] },
      })
    }

    if (conditions.length === 0) {
      return {}
    }

    return { $and: conditions }
  }

  public async getNTransactionsHitByRuleInstance(
    value: number,
    ruleInstanceId: string,
    excludeDestinationUserIds: string[] = [],
    excludeTransactionIds: string[] = [],
    timestamps?: { afterTimestamp: number; beforeTimestamp: number }
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)
    const result = await collection
      .find({
        'hitRules.ruleInstanceId': ruleInstanceId,
        destinationUserId: { $nin: excludeDestinationUserIds },
        transactionId: { $nin: excludeTransactionIds },
        ...(timestamps
          ? {
              timestamp: {
                $gte: timestamps.afterTimestamp,
                $lte: timestamps.beforeTimestamp,
              },
            }
          : {}),
      })
      .sort({ timestamp: -1 })
      .allowDiskUse()
      .limit(value)
      .toArray()
    return result
  }

  public async getNTransactionsNotHitByRuleInstance(
    value: number,
    excludeRuleInstanceId?: string,
    excludeDestinationUserIds: string[] = [],
    excludeTransactionIds: string[] = [],
    timestamps?: { afterTimestamp: number; beforeTimestamp: number }
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)
    const result = await collection
      .find({
        ...(excludeRuleInstanceId
          ? {
              'hitRules.ruleInstanceId': { $ne: excludeRuleInstanceId },
              destinationUserId: { $nin: excludeDestinationUserIds },
              transactionId: { $nin: excludeTransactionIds },
            }
          : {}),
        ...(timestamps
          ? {
              timestamp: {
                $gte: timestamps.afterTimestamp,
                $lte: timestamps.beforeTimestamp,
              },
            }
          : {}),
      })
      .sort({ timestamp: -1 })
      .allowDiskUse()
      .limit(value)
      .toArray()
    return result
  }

  public getTransactionsCursor(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): AggregationCursor<InternalTransaction> {
    const query = this.getTransactionsMongoQuery(params)
    return this.getDenormalizedTransactions(query, params)
  }

  private getDenormalizedTransactions(
    query: Filter<InternalTransaction>,
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ) {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)
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
          lookupPipelineStage({
            from: USERS_COLLECTION(this.tenantId),
            localField: 'originUserId',
            foreignField: 'userId',
            as: 'originUser',
          }),
          lookupPipelineStage({
            from: USERS_COLLECTION(this.tenantId),
            localField: 'destinationUserId',
            foreignField: 'userId',
            as: 'destinationUser',
          }),
          {
            $set: {
              originUser: { $first: '$originUser' },
              destinationUser: { $first: '$destinationUser' },
            },
          },
        ]
      )
    }

    return collection.aggregate<InternalTransaction>(pipeline)
  }

  public async getTransactionsCount(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const query = this.getTransactionsMongoQuery(params)
    return collection.countDocuments(query, { limit: COUNT_QUERY_LIMIT })
  }

  public async getTransactionsCountByQuery(
    query: Filter<InternalTransaction>,
    limit?: number
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    return await collection.countDocuments(query, { limit })
  }

  public async getAllTransactionsCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    return await collection.estimatedDocumentCount({})
  }

  public async getUsersCount(
    filters?: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    const filter = filters
      ? {
          timestamp: {
            $gte: filters.afterTimestamp,
            $lte: filters.beforeTimestamp,
          },
        }
      : {}

    const [originUsers, destinationUsers] = await Promise.all([
      collection.distinct('originUserId', filter),
      collection.distinct('destinationUserId', filter),
    ])

    return compact(uniq([...originUsers, ...destinationUsers])).length
  }

  public async getTransactions(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<{ total: number; data: InternalTransaction[] }> {
    const cursor = this.getTransactionsCursor(params)
    const total = await this.getTransactionsCount(params)
    return { total, data: await cursor.toArray() }
  }

  public async getTransactionsByIds(
    transactionIds: string[]
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const query = { transactionId: { $in: transactionIds } }
    const cursor = collection.find(query)

    return await cursor.toArray()
  }

  public async getTransactionsWithoutArsScoreCursor(timestamps: {
    afterCreatedAt: number
    beforeCreatedAt: number
  }): Promise<FindCursor<InternalTransaction>> {
    const db = this.mongoDb.db()
    const transactionsCollectionName = TRANSACTIONS_COLLECTION(this.tenantId)
    const { afterCreatedAt, beforeCreatedAt } = timestamps
    const transactionsWithoutArsScore = db
      .collection<InternalTransaction>(transactionsCollectionName)
      .find({
        arsScore: null as any,
        createdAt: { $gte: afterCreatedAt, $lte: beforeCreatedAt },
      })
      .sort({ createdAt: 1 })

    return transactionsWithoutArsScore
  }

  public async getTransactionsCursorPaginate(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<CursorPaginationResponse<InternalTransaction>> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const filter = this.getTransactionsMongoQuery(params)

    return await cursorPaginate<InternalTransaction>(collection, filter, {
      pageSize: params.pageSize ? (params.pageSize as number) : 20,
      sortField: params.sortField || 'timestamp',
      fromCursorKey: params.start,
      sortOrder: params.sortOrder,
    })
  }

  public async getInternalTransaction(
    transactionId: string
  ): Promise<InternalTransaction | null> {
    return this.getDenormalizedTransactions(
      { transactionId },
      { includeUsers: true, beforeTimestamp: Date.now() }
    ).next()
  }

  public async getInternalTransactionById(
    transactionId: string
  ): Promise<InternalTransaction | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    return collection.findOne<InternalTransaction>({ transactionId })
  }

  private getExecutedTransactionsMongoQuery(
    userId: string,
    ruleInstanceId: string
  ): Filter<InternalTransaction> {
    const query: Filter<InternalTransaction> = {
      $or: [
        { originUserId: { $in: [userId] } },
        { destinationUserId: { $in: [userId] } },
      ],
      'executedRules.ruleInstanceId': ruleInstanceId,
    }

    return query
  }

  public async getExecutedTransactionsOfAlert(
    userId: string,
    ruleInstanceId: string,
    pagination: OptionalPaginationParams
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    const query = this.getExecutedTransactionsMongoQuery(userId, ruleInstanceId)

    const cursor = collection.find(query).sort({ timestamp: -1 }).allowDiskUse()
    const paginatedCursor = paginateCursor(cursor, pagination)

    return await paginatedCursor.toArray()
  }

  public async getExecutedTransactionsOfAlertCount(
    userId: string,
    ruleInstanceId: string
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    const query = this.getExecutedTransactionsMongoQuery(userId, ruleInstanceId)

    return await collection.countDocuments(query, { limit: COUNT_QUERY_LIMIT })
  }

  public async getUniques(
    params: {
      field: TransactionsUniquesField
      direction: 'origin' | 'destination'
      filter?: string
    },
    additionalFilters: Filter<InternalTransaction>[] = []
  ): Promise<string[]> {
    const db = this.mongoDb.db()

    if (params.field === 'TAGS_KEY') {
      const uniqueTagsCollection = db.collection(
        UNIQUE_TAGS_COLLECTION(this.tenantId)
      )

      const uniqueTags = await uniqueTagsCollection
        .find({ type: 'TRANSACTION' })
        .project({ tag: 1 })
        .toArray()

      return uniqueTags.map((doc) => doc.tag)
    }
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    let fieldPath: string
    const unwindPath = ''

    const filterConditions = additionalFilters
    const paymentDetailsPath =
      params.direction === 'origin'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'
    const amountDetailsPath =
      params.direction === 'origin'
        ? 'originAmountDetails'
        : 'destinationAmountDetails'

    const ipAddressPath =
      params.direction === 'origin'
        ? 'originDeviceData.ipAddress'
        : 'destinationDeviceData.ipAddress'

    const deviceIdentifierPath =
      params.direction === 'origin'
        ? 'originDeviceData.deviceIdentifier'
        : 'destinationDeviceData.deviceIdentifier'

    switch (params.field) {
      case 'TRANSACTION_STATE':
        fieldPath = 'transactionState'
        break
      case 'PAYMENT_CHANNELS':
        fieldPath = `${paymentDetailsPath}.paymentChannel`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'CARD',
        })
        break
      case 'BANK_NAMES':
        fieldPath = `${paymentDetailsPath}.bankName`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: {
            $in: ['GENERIC_BANK_ACCOUNT', 'SWIFT', 'ACH', 'IBAN'],
          },
        })
        break
      case 'IBAN_NUMBER':
        fieldPath = `${paymentDetailsPath}.IBAN`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'IBAN',
        })
        break
      case 'CARD_FINGERPRINT_NUMBER':
        fieldPath = `${paymentDetailsPath}.cardFingerprint`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'CARD',
        })
        break
      case 'BANK_ACCOUNT_NUMBER':
        fieldPath = `${paymentDetailsPath}.accountNumber`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'GENERIC_BANK_ACCOUNT',
        })
        break
      case 'ACH_ACCOUNT_NUMBER':
        fieldPath = `${paymentDetailsPath}.accountNumber`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'ACH',
        })
        break
      case 'SWIFT_ACCOUNT_NUMBER':
        fieldPath = `${paymentDetailsPath}.accountNumber`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'SWIFT',
        })
        break
      case 'BIC':
        fieldPath = `${paymentDetailsPath}.BIC`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'IBAN',
        })
        break
      case 'BANK_SWIFT_CODE':
        fieldPath = `${paymentDetailsPath}.swiftCode`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'SWIFT',
        })
        break
      case 'UPI_IDENTIFYING_NUMBER':
        fieldPath = `${paymentDetailsPath}.upiID`
        filterConditions.push({
          [`${paymentDetailsPath}.method`]: 'UPI',
        })
        break
      case 'IP_ADDRESS':
        fieldPath = ipAddressPath
        break
      case 'DEVICE_IDENTIFIER':
        fieldPath = deviceIdentifierPath
        break
      case 'CURRENCY':
        fieldPath = `${amountDetailsPath}.transactionCurrency`
        break
      case 'COUNTRY':
        fieldPath = `${amountDetailsPath}.country`
        break
      case 'PRODUCT_TYPES':
        fieldPath = 'productType'
        break
      default:
        throw neverThrow(params.field, `Unknown field: ${params.field}`)
    }

    if (
      params.filter &&
      !(params.field === 'IP_ADDRESS' && params.direction === 'origin')
    ) {
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
      filterConditions.length > 0 || unwindPath.length > 0
        ? { $limit: 10000 }
        : {},
      unwindPath.length > 0
        ? {
            $unwind: {
              path: `$${unwindPath}`,
              includeArrayIndex: 'string',
            },
          }
        : {},
      {
        $match: {
          [fieldPath]: { $ne: null },
        },
      },
      {
        $group: {
          _id: `$${fieldPath}`,
        },
      },
      {
        $limit: 100,
      },
    ].filter((stage) => !isEmpty(stage))

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
    const collection = db.collection<InternalTransaction>(name)
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
    referenceCurrency: Currency,
    aggregateBy: 'status' | 'transactionState'
  ): Promise<TransactionsStatsByTimeResponse['data']> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)
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
    minMaxPipeline.push({ $sort: { timestamp: 1 } })
    minMaxPipeline.push({
      $group: {
        _id: '_id',
        oldest: {
          $first: '$timestamp',
        },
        youngest: {
          $last: '$timestamp',
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
    const timezone = dayjsLib.tz.guess()

    let seriesFormat: string
    let labelFormat: string
    const dur = duration(difference)
    if (dur.asMonths() > 1) {
      seriesFormat = 'YYYY/MM/01 00:00 Z'
      labelFormat = 'YYYY/MM'
    } else if (dur.asDays() > 1) {
      seriesFormat = 'YYYY/MM/DD 00:00 Z'
      labelFormat = 'MM/DD'
    } else {
      seriesFormat = 'YYYY/MM/DD HH:00 Z'
      labelFormat = 'MM/DD HH:00'
    }

    const result: TransactionsStatsByTimeResponse['data'] = []

    const transactionsCursor = collection.find(query, {
      sort: { [sortField]: sortOrder },
      ...paginateFindOptions(params),
    })
    for await (const transaction of transactionsCursor) {
      if (transaction.timestamp && transaction.status) {
        const series = dayjsLib
          .tz(transaction.timestamp, timezone)
          .format(seriesFormat)
        const label = dayjsLib
          .tz(transaction.timestamp, timezone)
          .format(labelFormat)
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
        const key = transaction[aggregateBy]
        if (key) {
          const ruleActionCounter = counters.values[key] ?? {
            count: 0,
            amount: 0,
          }
          counters.values[key] = ruleActionCounter

          ruleActionCounter.count = ruleActionCounter.count + 1
          ruleActionCounter.amount = ruleActionCounter.amount + amount
        }
      }
    }

    return result
  }

  private async getAmount(
    transaction: InternalTransaction,
    referenceCurrency: Currency
  ): Promise<number> {
    let amount = 0
    const currencyService = new CurrencyService()

    if (transaction.originAmountDetails != null) {
      if (
        transaction.originAmountDetails.transactionCurrency != referenceCurrency
      ) {
        const exchangeRate = await currencyService.getCurrencyExchangeRate(
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

  /**
   * Methods used by rules engine
   */

  public async getLastNUserSendingTransactions(
    userId: string,
    n: number,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    return this.getRulesEngineTransactions(
      [{ originUserId: { $eq: userId } }],
      undefined,
      filterOptions,
      attributesToFetch,
      n
    )
  }

  public async getLastNUserReceivingTransactions(
    userId: string,
    n: number,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    return this.getRulesEngineTransactions(
      [{ destinationUserId: { $eq: userId } }],
      undefined,
      filterOptions,
      attributesToFetch,
      n
    )
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
    yield* this.getRulesEngineTransactionsGenerator(
      [{ originUserId: { $eq: userId } }],
      timeRange,
      filterOptions,
      attributesToFetch
    )
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

  public async *getNonUserSendingTransactionsGenerator(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
    if (!identifiers) {
      yield []
    } else {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          mapKeys(
            omitBy({ method: paymentDetails.method, ...identifiers }, isNil),
            (_value, key) => `originPaymentDetails.${key}`
          ),
        ],
        timeRange,
        filterOptions,
        attributesToFetch
      )
    }
  }

  public async *getUserReceivingTransactionsGenerator(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    yield* this.getRulesEngineTransactionsGenerator(
      [{ destinationUserId: { $eq: userId } }],
      timeRange,
      filterOptions,
      attributesToFetch
    )
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

  public async *getNonUserReceivingTransactionsGenerator(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
    if (!identifiers) {
      yield []
    } else {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          mapKeys(
            omitBy({ method: paymentDetails.method, ...identifiers }, isNil),
            (_value, key) => `destinationPaymentDetails.${key}`
          ),
        ],
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
    return this.getRulesEngineTransactionsCount(
      [{ originUserId: { $eq: userId } }],
      timeRange,
      filterOptions
    )
  }

  public async getUserReceivingTransactionsCount(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    return this.getRulesEngineTransactionsCount(
      [{ destinationUserId: { $eq: userId } }],
      timeRange,
      filterOptions
    )
  }

  public async getNonUserSendingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
    if (!identifiers) {
      return 0
    }
    return this.getRulesEngineTransactionsCount(
      [
        mapKeys(
          omitBy({ method: paymentDetails.method, ...identifiers }, isNil),
          (_value, key) => `originPaymentDetails.${key}`
        ),
      ],
      timeRange,
      filterOptions
    )
  }

  public async getNonUserReceivingTransactionsCount(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ): Promise<number> {
    const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
    if (!identifiers) {
      return 0
    }
    return this.getRulesEngineTransactionsCount(
      [
        mapKeys(
          omitBy({ method: paymentDetails.method, ...identifiers }, isNil),
          (_value, key) => `destinationPaymentDetails.${key}`
        ),
      ],
      timeRange,
      filterOptions
    )
  }

  public async hasAnySendingTransaction(
    userId: string,
    filterOptions: TransactionsFilterOptions
  ): Promise<boolean> {
    const transactions = await this.getRulesEngineTransactions(
      [{ originUserId: { $eq: userId } }],
      undefined,
      filterOptions,
      [],
      1
    )
    return transactions.length > 0
  }

  public async getIpAddressTransactions(
    ipAddress: string,
    timeRange: TimeRange,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    return this.getRulesEngineTransactions(
      [
        {
          $or: [
            { 'originDeviceData.ipAddress': ipAddress },
            { 'destinationDeviceData.ipAddress': ipAddress },
          ],
        },
      ],
      timeRange,
      {},
      attributesToFetch
    )
  }

  private getRulesEngineTransactionsQuery(
    filters: Filter<InternalTransaction>[],
    timeRange: TimeRange | undefined,
    filterOptions: TransactionsFilterOptions
  ): Filter<InternalTransaction> {
    const additionalFilters = [...filters]
    if (!isEmpty(filterOptions.transactionAmountRange)) {
      additionalFilters.push({
        $or: Object.entries(filterOptions.transactionAmountRange).flatMap(
          (entry) => [
            {
              'originAmountDetails.transactionCurrency': entry[0],
              'originAmountDetails.transactionAmount': {
                $gte: entry[1].min ?? 0,
                $lte: entry[1].max ?? Number.MAX_SAFE_INTEGER,
              },
            },
            {
              'destinationAmountDetails.transactionCurrency': entry[0],
              'destinationAmountDetails.transactionAmount': {
                $gte: entry[1].min ?? 0,
                $lte: entry[1].max ?? Number.MAX_SAFE_INTEGER,
              },
            },
          ]
        ),
      })
    }
    return this.getTransactionsMongoQuery(
      {
        ...timeRange,
        filterTransactionTypes: filterOptions.transactionTypes,
        filterTransactionState: filterOptions.transactionStates,
        filterOriginPaymentMethods: filterOptions.originPaymentMethods,
        filterDestinationPaymentMethods:
          filterOptions.destinationPaymentMethods,
        filterOriginCountries: filterOptions.originCountries,
        filterDestinationCountries: filterOptions.destinationCountries,
      },
      additionalFilters
    )
  }

  private async getRulesEngineTransactionsCount(
    filters: Filter<InternalTransaction>[],
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions
  ) {
    const query = this.getRulesEngineTransactionsQuery(
      filters,
      timeRange,
      filterOptions
    )
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    return collection.count(query)
  }

  private async *getRulesEngineTransactionsGenerator(
    filters: Filter<InternalTransaction>[],
    timeRange: TimeRange | undefined,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    limit?: number
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    const query = this.getRulesEngineTransactionsQuery(
      filters,
      timeRange,
      filterOptions
    )
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const finalAttributesToFetch = uniq<keyof AuxiliaryIndexTransaction>(
      attributesToFetch.concat([
        'timestamp',
        'originUserId',
        'originPaymentDetails',
        'destinationUserId',
        'destinationPaymentDetails',
      ])
    )
    const transactions = await collection
      .find(query, {
        sort: { timestamp: -1 },
        limit,
      })
      .project(
        Object.fromEntries(
          finalAttributesToFetch.map((attribute) => [attribute, 1])
        )
      )
      .toArray()
    let transactionsBatch: AuxiliaryIndexTransaction[] = []
    const transactionTimeRange = filterOptions.transactionTimeRange24hr
    for (const transaction of transactions) {
      const tx = transaction as InternalTransaction
      const isValid = transactionTimeRange
        ? transactionTimeRangeRuleFilterPredicate(
            tx.timestamp,
            transactionTimeRange
          )
        : true
      if (isValid) {
        transactionsBatch.push({
          ...transaction,
          senderKeyId: getSenderKeyId(this.tenantId, tx),
          receiverKeyId: getReceiverKeyId(this.tenantId, tx),
        })
      }
      if (transactionsBatch.length === 100) {
        yield transactionsBatch
        transactionsBatch = []
      }
    }
    if (transactionsBatch.length) {
      yield transactionsBatch
    }
  }

  // TODO: Remove this after all rules support streaming
  private async getRulesEngineTransactions(
    filters: Filter<InternalTransaction>[],
    timeRange: TimeRange | undefined,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    limit?: number
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const generator = this.getRulesEngineTransactionsGenerator(
      filters,
      timeRange,
      filterOptions,
      attributesToFetch,
      limit
    )
    const transactions: Array<AuxiliaryIndexTransaction> = []
    for await (const data of generator) {
      transactions.push(...data)
    }
    return transactions
  }

  public async updateArsScore(
    transactionId: string,
    arsScore: ArsScore
  ): Promise<void> {
    await this.updateTransaction(transactionId, { arsScore })
  }

  private async updateTransaction(
    transactionId: string,
    update: Partial<InternalTransaction>
  ) {
    await internalMongoUpdateOne(
      this.mongoDb,
      TRANSACTIONS_COLLECTION(this.tenantId),
      { transactionId },
      { $set: update }
    )
  }

  public sampleTransactionsCursor(
    count: number
  ): AggregationCursor<InternalTransaction> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    return collection.aggregate<InternalTransaction>([
      { $sample: { size: count } },
    ])
  }

  /**
   * Not inserting into clickhouse because this is a metadata update
   * We can do something like
   * SELECT id
   * FROM transactions
   * WHERE id IN (
   *     SELECT arrayJoin(transactionIds)
   *     FROM alert
   *     WHERE alertId = 'A-1'
   * )
   */

  public async updateTransactionAlertIds(
    transactionIds?: string[],
    alertIds?: string[]
  ): Promise<void> {
    if (!transactionIds || !alertIds) {
      return
    }
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    await collection.updateMany(
      { transactionId: { $in: transactionIds } },
      {
        $addToSet: {
          alertIds: { $each: alertIds },
        },
      }
    )
  }

  /**
   * Same as updateTransactionAlertIds but removing the alertIds
   * We can do something like above here also
   */
  public async removeTransactionAlertIds(
    transactionIds?: string[],
    alertIds?: string[]
  ): Promise<void> {
    if (!transactionIds || !alertIds) {
      return
    }
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    await collection.updateMany(
      { transactionId: { $in: transactionIds } },
      {
        $pull: {
          alertIds: { $in: alertIds },
        },
      }
    )
  }

  public async getUniqueUserIds(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange: TimeRange
  ): Promise<string[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const userField =
      direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
    const result = await collection
      .aggregate([
        {
          $match: {
            timestamp: {
              $gte: timeRange.afterTimestamp,
              $lt: timeRange.beforeTimestamp,
            },
            [userField]: { $exists: true },
          },
        },
        {
          $group: {
            _id: `$${userField}`,
          },
        },
      ])
      .toArray()
    return result.map((v) => v._id)
  }

  public async getUniquePaymentDetails(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange: TimeRange
  ): Promise<PaymentDetails[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const paymentDetailsField =
      direction === 'ORIGIN'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'

    let allResult: PaymentDetails[] = []
    for (const paymentMethod in PAYMENT_METHOD_IDENTIFIER_FIELDS) {
      const paymentIdentifiers =
        PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentMethod as PaymentMethod]
      const result = await collection
        .aggregate([
          {
            $match: {
              timestamp: {
                $gte: timeRange.afterTimestamp,
                $lt: timeRange.beforeTimestamp,
              },
              [paymentDetailsField]: { $exists: true },
              [`${paymentDetailsField}.method`]: paymentMethod,
            },
          },
          {
            $group: {
              _id: paymentIdentifiers.map(
                (field) => `$${paymentDetailsField}.${field}`
              ),
            },
          },
        ])
        .toArray()

      allResult = allResult.concat(
        result.map((v) => ({
          method: paymentMethod,
          ...Object.fromEntries(
            paymentIdentifiers.map((field, index) => [field, v._id[index]])
          ),
        }))
      )
    }
    return allResult
  }
  public async getRuleInstanceHitStats(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number },
    isShadowRule: boolean
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const timestampMatch = {
      timestamp: {
        $gte: timeRange.afterTimestamp,
        $lt: timeRange.beforeTimestamp,
      },
    }
    const ruleElementMatchCondition = {
      ruleInstanceId,
    }
    if (isShadowRule) {
      ruleElementMatchCondition['isShadow'] = true
    } else {
      ruleElementMatchCondition['isShadow'] = { $ne: true }
    }

    const groupBy = {
      $dateToString: {
        format: DAY_DATE_FORMAT,
        date: { $toDate: '$timestamp' },
      },
    }
    const hitMatch = {
      ...timestampMatch,
      hitRules: { $elemMatch: ruleElementMatchCondition },
    }
    const hitPipeline = [
      { $match: hitMatch },
      { $unwind: '$hitRules' },
      {
        $match: mapKeys(
          ruleElementMatchCondition,
          (_value, key) => `hitRules.${key}`
        ),
      },
      {
        $project: {
          timestamp: 1,
          userIds: {
            $concatArrays: [
              {
                $cond: {
                  if: {
                    $in: [
                      'ORIGIN',
                      {
                        $ifNull: ['$hitRules.ruleHitMeta.hitDirections', []],
                      },
                    ],
                  },
                  then: ['$originUserId'],
                  else: [],
                },
              },
              {
                $cond: {
                  if: {
                    $in: [
                      'DESTINATION',
                      {
                        $ifNull: ['$hitRules.ruleHitMeta.hitDirections', []],
                      },
                    ],
                  },
                  then: ['$destinationUserId'],
                  else: [],
                },
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: groupBy,
          hitCount: { $sum: 1 },
          hitUserIds: { $addToSet: '$userIds' },
        },
      },
    ]
    const hitResult = await collection.aggregate(hitPipeline).toArray()
    return mapValues(keyBy(hitResult, '_id'), (v) => ({
      ...v,
      hitUsersCount: v.hitUserIds.length,
    }))
  }

  private async updateUniqueTransactionTags(
    transaction: InternalTransaction
  ): Promise<void> {
    if (!transaction.tags || transaction.tags.length === 0) {
      return
    }

    const db = this.mongoDb.db()
    const uniqueTagsCollection = db.collection(
      UNIQUE_TAGS_COLLECTION(this.tenantId)
    )

    const uniqueTags = uniq(transaction.tags.map((tag) => tag.key))

    await Promise.all(
      uniqueTags.map((tag) =>
        uniqueTagsCollection.updateOne(
          { tag, type: 'TRANSACTION' },
          { $set: { tag, type: 'TRANSACTION' } },
          { upsert: true }
        )
      )
    )
  }
}
