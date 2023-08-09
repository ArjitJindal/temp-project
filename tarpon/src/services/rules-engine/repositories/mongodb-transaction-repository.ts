import { AggregationCursor, Document, Filter, MongoClient } from 'mongodb'
import _ from 'lodash'
import { getReceiverKeyId, getSenderKeyId } from '../utils'
import {
  AuxiliaryIndexTransaction,
  RulesEngineTransactionRepositoryInterface,
  TimeRange,
  TransactionsFilterOptions,
} from './transaction-repository-interface'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { Tag } from '@/@types/openapi-public/Tag'
import {
  paginateFindOptions,
  paginatePipeline,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  prefixRegexMatchFilter,
  paginateCursor,
  lookupPipelineStage,
} from '@/utils/mongoDBUtils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { TransactionType } from '@/@types/openapi-public/TransactionType'
import { Currency, getCurrencyExchangeRate } from '@/utils/currency-utils'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import dayjs, { duration } from '@/utils/dayjs'
import { getTimeLabels } from '@/lambdas/console-api-dashboard/utils'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'
import { neverThrow } from '@/utils/lang'
import {
  OptionalPagination,
  COUNT_QUERY_LIMIT,
  OptionalPaginationParams,
  cursorPaginate,
  CursorPaginationResponse,
} from '@/utils/pagination'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import {
  getPaymentDetailsIdentifiers,
  getPaymentMethodId,
} from '@/core/dynamodb/dynamodb-keys'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'

export class MongoDbTransactionRepository
  implements RulesEngineTransactionRepositoryInterface
{
  mongoDb: MongoClient
  tenantId: string

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.mongoDb = mongoDb
    this.tenantId = tenantId
  }

  async addTransactionToMongo(
    transaction: TransactionWithRulesResult
  ): Promise<InternalTransaction> {
    const db = this.mongoDb.db()
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    const internalTransaction: InternalTransaction = {
      ...transaction,
      originPaymentMethodId: getPaymentMethodId(
        transaction.originPaymentDetails
      ),
      destinationPaymentMethodId: getPaymentMethodId(
        transaction.destinationPaymentDetails
      ),
    }

    const existingTransaction = await this.getTransactionById(
      transaction.transactionId
    )

    internalTransaction.createdAt = existingTransaction?.createdAt ?? Date.now()

    // TODO we are moving status to be populated in dynamo, however in the transition we may
    // process transactions without a status set.
    if (internalTransaction && !internalTransaction.status) {
      internalTransaction.status = getAggregatedRuleStatus(
        internalTransaction.hitRules.map((hr) => hr.ruleAction)
      )
    }

    await transactionsCollection.replaceOne(
      { transactionId: transaction.transactionId },
      internalTransaction,
      { upsert: true }
    )
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

    const executedRulesFilters = []
    if (params.filterRulesExecuted != null) {
      executedRulesFilters.push({
        $elemMatch: { ruleId: { $in: params.filterRulesExecuted } },
      })
    }
    if (params.filterRuleInstancesExecuted != null) {
      conditions.push({
        'executedRules.ruleInstanceId': {
          $in: params.filterRuleInstancesExecuted,
        },
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
    if (params.filterRuleInstancesHit) {
      executedRulesFilters.push({
        $elemMatch: {
          ruleHit: true,
          ruleInstanceId: { $eq: params.filterRuleInstancesHit },
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

    if (params.filterTransactionStatus && params.filterRuleInstancesHit) {
      const ruleInstanceId = params.filterRuleInstancesHit
      conditions.push({
        $or: [
          {
            executedRules: {
              $elemMatch: {
                ruleInstanceId: ruleInstanceId,
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
                        ruleInstanceId: ruleInstanceId,
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
      const elemCondition: { [attr: string]: Filter<Tag> } = {}
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

  public async getLastNTransactionsHitByRuleInstance(
    value: number,
    ruleInstanceId: string
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)
    const result = await collection
      .find({ 'hitRules.ruleInstanceId': ruleInstanceId })
      .sort({ createdTimestamp: -1 })
      .allowDiskUse()
      .limit(value)
      .toArray()
    return result
  }

  public async getLastNTransactionsNotHitByRuleInstance(
    value: number,
    excludeRuleInstanceId?: string
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)
    const result = await collection
      .find(
        excludeRuleInstanceId
          ? { 'hitRules.ruleInstanceId': { $ne: excludeRuleInstanceId } }
          : {}
      )
      .sort({ createdTimestamp: -1 })
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
    if (params?.includeEvents) {
      pipeline.push(
        ...[
          lookupPipelineStage({
            from: TRANSACTION_EVENTS_COLLECTION(this.tenantId),
            localField: 'transactionId',
            foreignField: 'transactionId',
            as: 'events',
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
            _let: { eventTransactionId: '$transactionId' },
          }),
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
    query: Filter<InternalTransaction>
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )

    return await collection.countDocuments(query)
  }

  public async getAllTransactionsCount(): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    return await collection.estimatedDocumentCount()
  }

  public async getTransactions(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<{ total: number; data: InternalTransaction[] }> {
    const cursor = await this.getTransactionsCursor(params)
    const total = await this.getTransactionsCount(params)
    return { total, data: await cursor.toArray() }
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
      sortField: params.sortField,
      fromCursorKey: params.start,
      sortOrder: params.sortOrder,
    })
  }

  public async getInternalTransaction(
    transactionId: string
  ): Promise<InternalTransaction | null> {
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
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    let fieldPath: string
    let unwindPath = ''

    const filterConditions = additionalFilters
    const paymentDetailsPath =
      params.direction === 'origin'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'
    const amountDetailsPath =
      params.direction === 'origin'
        ? 'originAmountDetails'
        : 'destinationAmountDetails'
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
      case 'TAGS_KEY':
        fieldPath = 'tags.key'
        unwindPath = 'tags'
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
        fieldPath = 'deviceData.ipAddress'
        break
      case 'CURRENCY':
        fieldPath = `${paymentDetailsPath}.upiID`
        fieldPath = `${amountDetailsPath}.transactionCurrency`
        break
      case 'COUNTRY':
        fieldPath = `${amountDetailsPath}.country`
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
    referenceCurrency: Currency
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
      if (transaction.timestamp && transaction.status) {
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
    transaction: InternalTransaction,
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
    return this.getRulesEngineTransactions(
      [{ originUserId: { $eq: userId } }],
      timeRange,
      filterOptions,
      attributesToFetch
    )
  }

  public async getNonUserSendingTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
    if (!identifiers) {
      return []
    }
    return this.getRulesEngineTransactions(
      [
        _.mapKeys(
          _.omitBy({ method: paymentDetails.method, ...identifiers }, _.isNil),
          (_value, key) => `originPaymentDetails.${key}`
        ),
      ],
      timeRange,
      filterOptions,
      attributesToFetch
    )
  }

  public async getUserReceivingTransactions(
    userId: string,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    return this.getRulesEngineTransactions(
      [{ destinationUserId: { $eq: userId } }],
      timeRange,
      filterOptions,
      attributesToFetch
    )
  }

  public async getNonUserReceivingTransactions(
    paymentDetails: PaymentDetails,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
    if (!identifiers) {
      return []
    }
    return this.getRulesEngineTransactions(
      [
        _.mapKeys(
          _.omitBy({ method: paymentDetails.method, ...identifiers }, _.isNil),
          (_value, key) => `destinationPaymentDetails.${key}`
        ),
      ],
      timeRange,
      filterOptions,
      attributesToFetch
    )
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
        _.mapKeys(
          _.omitBy({ method: paymentDetails.method, ...identifiers }, _.isNil),
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
        _.mapKeys(
          _.omitBy({ method: paymentDetails.method, ...identifiers }, _.isNil),
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
      [{ 'deviceData.ipAddress': ipAddress }],
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
    if (!_.isEmpty(filterOptions.transactionAmountRange)) {
      additionalFilters.push({
        $or: Object.entries(filterOptions.transactionAmountRange).map(
          (entry) => ({
            'originAmountDetails.transactionCurrency': entry[0],
            'originAmountDetails.transactionAmount': {
              $gte: entry[1].min ?? 0,
              $lte: entry[1].max ?? Number.MAX_SAFE_INTEGER,
            },
          })
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

  private async getRulesEngineTransactions(
    filters: Filter<InternalTransaction>[],
    timeRange: TimeRange | undefined,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    limit?: number
  ): Promise<Array<AuxiliaryIndexTransaction>> {
    const query = this.getRulesEngineTransactionsQuery(
      filters,
      timeRange,
      filterOptions
    )
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const finalAttributesToFetch = _.uniq<keyof AuxiliaryIndexTransaction>(
      attributesToFetch.concat([
        'timestamp',
        'originUserId',
        'originPaymentDetails',
        'destinationUserId',
        'destinationPaymentDetails',
      ])
    )
    const transactions = (await collection
      .find(query, {
        sort: { timestamp: -1 },
        limit,
      })
      .project(
        Object.fromEntries(
          finalAttributesToFetch.map((attribute) => [attribute, 1])
        )
      )
      .toArray()) as InternalTransaction[]
    return transactions.map((transaction) => ({
      ...transaction,
      senderKeyId: getSenderKeyId(this.tenantId, transaction),
      receiverKeyId: getReceiverKeyId(this.tenantId, transaction),
    }))
  }
}
