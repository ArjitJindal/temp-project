import {
  AggregationCursor,
  ClientSession,
  Document,
  Filter,
  FindCursor,
  MongoClient,
} from 'mongodb'
import compact from 'lodash/compact'
import difference from 'lodash/difference'
import isEmpty from 'lodash/isEmpty'
import isNil from 'lodash/isNil'
import keyBy from 'lodash/keyBy'
import mapKeys from 'lodash/mapKeys'
import mapValues from 'lodash/mapValues'
import omitBy from 'lodash/omitBy'
import pick from 'lodash/pick'
import uniq from 'lodash/uniq'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import dayjsLib from '@flagright/lib/utils/dayjs'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
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
  getMongoDbClient,
  internalMongoUpdateOne,
  lookupPipelineStage,
  paginateCursor,
  paginateFindOptions,
  paginatePipeline,
  prefixRegexMatchFilter,
  regexMatchFilter,
  regexMatchFilterForArray,
} from '@/utils/mongodb-utils'
import { DAY_DATE_FORMAT } from '@/core/constants'
import {
  UNIQUE_TAGS_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongo-table-names'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  DefaultApiGetTransactionsListRequest,
  DefaultApiGetTransactionsStatsByTimeRequest,
  DefaultApiGetTransactionsStatsByTypeRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import { duration } from '@/utils/dayjs'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'
import { neverThrow } from '@/utils/lang'
import { cursorPaginate } from '@/utils/pagination'
import { COUNT_QUERY_LIMIT } from '@/constants/pagination'
import {
  CursorPaginationResponse,
  OptionalPagination,
  OptionalPaginationParams,
} from '@/@types/pagination'
import {
  PaymentDetails,
  PaymentMethod,
} from '@/@types/tranasction/payment-type'
import {
  getPaymentDetailsIdentifiers,
  PAYMENT_METHOD_IDENTIFIER_FIELDS,
} from '@/core/dynamodb/dynamodb-keys'
import { getPaymentMethodId } from '@/utils/payment-details'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { traceable } from '@/core/xray'
import { Currency, CurrencyService } from '@/services/currency'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { UserTag } from '@/@types/openapi-internal/UserTag'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Address } from '@/@types/openapi-public/Address'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { EntityData } from '@/@types/tranasction/aggregation'

const INTERNAL_ONLY_TRANSACTION_ATTRIBUTES = difference(
  InternalTransaction.getAttributeTypeMap().map((v) => v.name),
  uniq(TransactionWithRulesResult.getAttributeTypeMap().map((v) => v.name))
)

@traceable
export class MongoDbTransactionRepository
  implements RulesEngineTransactionRepositoryInterface
{
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  tenantId: string

  constructor(
    tenantId: string,
    mongoDb: MongoClient,
    dynamoDb: DynamoDBDocumentClient
  ) {
    this.mongoDb = mongoDb
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClientByEvent(event)

    return new MongoDbTransactionRepository(tenantId, mongoDb, dynamoDb)
  }

  async addTransactionToMongo(
    transaction: InternalTransaction,
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
      hitRules: filterOutInternalRules(transaction?.hitRules ?? []),
      executedRules: filterOutInternalRules(transaction?.executedRules ?? []),
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
        internalTransaction?.hitRules?.map((hr) => hr) ?? []
      )
    }

    const payload: InternalTransaction = {
      ...pick(internalTransaction, INTERNAL_ONLY_TRANSACTION_ATTRIBUTES),
      ...internalTransaction,
    }

    const promises: Promise<any>[] = [
      internalMongoUpdateOne(
        this.mongoDb,
        TRANSACTIONS_COLLECTION(this.tenantId),
        { transactionId: transaction.transactionId },
        { $set: payload },
        { session: options?.session }
      ),
      this.updateUniqueTransactionTags(transaction),
    ]
    await Promise.all(promises)

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

  public getApproveTransactionsMongoQuery(): Filter<InternalTransaction> {
    return {
      $and: [
        { status: 'ALLOW' },
        {
          $expr: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$hitRules',
                    as: 'rule',
                    cond: { $eq: ['$$rule.isShadow', false] }, // Filter rules where isShadow is false
                  },
                },
              },
              0, // Ensure at least one rule has isShadow: false
            ],
          },
        },
      ],
    }
  }

  public getTransactionsMongoQuery(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>,
    additionalFilters: Filter<InternalTransaction>[] = [],
    alert?: Alert | null
  ): Filter<InternalTransaction> {
    const conditions: Filter<InternalTransaction>[] = additionalFilters

    if (params.filterDestinationCountries) {
      conditions.push({
        'destinationAmountDetails.country': {
          $in: params.filterDestinationCountries,
        },
      })
    }

    if (params.filterPaymentDetailName) {
      const createPaymentDetailsFilter = (prefix: string) => ({
        $and: [
          { [`${prefix}.method`]: { $exists: true } },
          {
            $or: [
              {
                $and: [
                  { [`${prefix}.method`]: 'CARD' },
                  {
                    $expr: {
                      $regexMatch: {
                        input: {
                          $reduce: {
                            input: {
                              $filter: {
                                input: [
                                  `$${prefix}.nameOnCard.firstName`,

                                  `$${prefix}.nameOnCard.middleName`,

                                  `$${prefix}.nameOnCard.lastName`,
                                ],
                                as: 'part',
                                cond: { $ne: ['$$part', null] },
                              },
                            },
                            initialValue: '',
                            in: {
                              $cond: [
                                { $eq: ['$$value', ''] },
                                '$$this',
                                { $concat: ['$$value', ' ', '$$this'] },
                              ],
                            },
                          },
                        },
                        regex: params.filterPaymentDetailName,
                        options: 'i',
                      },
                    },
                  },
                ],
              },
              {
                $and: [
                  { [`${prefix}.method`]: 'NPP' },
                  {
                    $expr: {
                      $regexMatch: {
                        input: {
                          $reduce: {
                            input: {
                              $filter: {
                                input: [
                                  `$${prefix}.name.firstName`,

                                  `$${prefix}.name.middleName`,

                                  `$${prefix}.name.lastName`,
                                ],
                                as: 'part',
                                cond: { $ne: ['$$part', null] },
                              },
                            },
                            initialValue: '',
                            in: {
                              $cond: [
                                { $eq: ['$$value', ''] },
                                '$$this',
                                { $concat: ['$$value', ' ', '$$this'] },
                              ],
                            },
                          },
                        },
                        regex: params.filterPaymentDetailName,
                        options: 'i',
                      },
                    },
                  },
                ],
              },
              {
                [`${prefix}.method`]: { $nin: ['CARD', 'NPP'] },
                [`${prefix}.name`]: {
                  $regex: params.filterPaymentDetailName,
                  $options: 'i',
                },
              },
              {
                [`${prefix}.bankName`]: {
                  $regex: params.filterPaymentDetailName,
                  $options: 'i',
                },
              },
            ],
          },
        ],
      })

      conditions.push({
        $or: [
          createPaymentDetailsFilter('originPaymentDetails'),
          createPaymentDetailsFilter('destinationPaymentDetails'),
        ],
      } as Filter<InternalTransaction>)
      // This is added to handle the scenario of counter party tnxs with no accout number
      if (alert?.ruleId === 'R-169') {
        alert?.ruleHitMeta?.hitDirections?.includes('ORIGIN')
          ? conditions.push({
              destinationPaymentMethodId: undefined,
            })
          : conditions.push({
              originPaymentMethodId: undefined,
            })
      }
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

    if (params.afterPaymentApprovalTimestamp) {
      // santize the payment approval timestamps
      conditions.push({
        paymentApprovalTimestamp: {
          $gte: params.afterPaymentApprovalTimestamp || 0,
        },
      })
    }
    if (params.beforePaymentApprovalTimestamp) {
      // santize the payment approval timestamps
      conditions.push({
        paymentApprovalTimestamp: {
          $lt: params.beforePaymentApprovalTimestamp || Number.MAX_SAFE_INTEGER,
        },
      })
    }

    if (
      params.filterTransactionIds != null &&
      params.filterTransactionIds?.length > 0
    ) {
      conditions.push({
        transactionId: { $in: params.filterTransactionIds },
      })
    }
    if (
      !params.filterTransactionIds?.length &&
      params.filterIdList != null &&
      params.filterIdList?.length > 0
    ) {
      conditions.push({
        transactionId: regexMatchFilterForArray(params.filterIdList),
      })
    }
    if (params.filterId != null) {
      conditions.push({
        transactionId: regexMatchFilter(params.filterId),
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
      if (params.filterStatus.includes('ALLOW') && params.isPaymentApprovals) {
        params.filterStatus.splice(params.filterStatus.indexOf('ALLOW'), 1)
        conditions.push(this.getApproveTransactionsMongoQuery())
      } else if (params.filterStatus.length > 0) {
        conditions.push({ status: { $in: params.filterStatus } })
      }
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

    if (params.filterUserId || params.filterUserIds) {
      const userIds: string[] = []

      if (params.filterUserId != null) {
        userIds.push(params.filterUserId)
      }

      if (params.filterUserIds != null) {
        userIds.push(...params.filterUserIds)
      }
      conditions.push({
        $or: [
          {
            originUserId: { $in: userIds },
          },
          {
            destinationUserId: { $in: userIds },
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

    if (params.filterReference) {
      conditions.push({
        reference: { $in: [params.filterReference] },
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

    const uiToMongoSortField: Record<string, string> = {
      'originPayment.amount': 'originAmountDetails.transactionAmount',
      'destinationPayment.amount': 'destinationAmountDetails.transactionAmount',
    }
    const effectiveSortField = uiToMongoSortField[sortField] ?? sortField

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
      pipeline.push({ $sort: { [effectiveSortField]: sortOrder } })
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
    const filter = filters
      ? {
          timestamp: {
            $gte: filters.afterTimestamp,
            $lte: filters.beforeTimestamp,
          },
        }
      : {}

    const [originUsers, destinationUsers] = await Promise.all([
      this.getDistinctUsers('ORIGIN', filter),
      this.getDistinctUsers('DESTINATION', filter),
    ])

    return compact(uniq([...originUsers, ...destinationUsers])).length
  }

  private async getDistinctUsers(
    direction: 'ORIGIN' | 'DESTINATION',
    filter: Filter<InternalTransaction>
  ): Promise<string[]> {
    const db = this.mongoDb.db()
    const field = direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const userIds: string[] = []
    let hasMore = true
    const pageSize = 500
    let page = 0
    while (hasMore) {
      const currentData = await collection
        .aggregate<{ _id: string }>([
          {
            $match: filter,
          },
          {
            $group: {
              _id: `$${field}`,
            },
          },
          { $sort: { _id: 1 } },
          {
            $skip: page * pageSize,
          },
          {
            $limit: pageSize,
          },
        ])
        .toArray()
      if (currentData.length === 0) {
        hasMore = false
        break
      }
      userIds.push(...currentData.map((doc) => doc._id))
      page++
    }
    return userIds
  }

  public async getTransactions(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>
  ): Promise<{ total: number; data: InternalTransaction[] }> {
    const cursor = this.getTransactionsCursor(params)
    const total = await this.getTransactionsCount(params)
    return { total, data: await cursor.toArray() }
  }

  public async getTransactionsByIds(
    transactionIds: string[],
    filter?: Filter<InternalTransaction>,
    projection?: Document
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const query = { transactionId: { $in: transactionIds }, ...filter }
    const cursor = collection.find(query, { projection })

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

  public async getTransactionsOffsetPaginated(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>,
    options?: { projection?: Document },
    alert?: Alert | null
  ): Promise<{
    items: InternalTransaction[]
    count: number
  }> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const filter = this.getTransactionsMongoQuery(params, [], alert)

    const limit = params.pageSize !== 'DISABLED' ? Number(params.pageSize) : 20
    const page = params.page ?? 1

    const [items, count] = await Promise.all([
      collection
        .find(filter, {
          sort: {
            [params.sortField ?? 'timestamp']:
              params.sortOrder === 'ascend' ? 1 : -1,
          },
          limit,
          skip: (page - 1) * limit,
          projection: options?.projection,
        })
        .toArray(),
      collection.countDocuments(filter),
    ])

    return { items, count }
  }

  /**
   * Gets only transaction data without count calculation for improved performance
   */
  public async getTransactionsDataOnly(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>,
    options?: { projection?: Document },
    alert?: Alert | null
  ): Promise<InternalTransaction[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const filter = this.getTransactionsMongoQuery(params, [], alert)

    const limit = params.pageSize !== 'DISABLED' ? Number(params.pageSize) : 20
    const page = params.page ?? 1

    const items = await collection
      .find(filter, {
        sort: {
          [params.sortField ?? 'timestamp']:
            params.sortOrder === 'ascend' ? 1 : -1,
        },
        limit,
        skip: (page - 1) * limit,
        projection: options?.projection,
      })
      .toArray()

    return items
  }

  /**
   * Gets only the count of transactions without fetching data for improved performance
   */
  public async getTransactionsCountOnly(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>,
    alert?: Alert | null
  ): Promise<number> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const filter = this.getTransactionsMongoQuery(params, [], alert)

    return await collection.countDocuments(filter)
  }

  public async getTransactionsCursorPaginated(
    params: OptionalPagination<DefaultApiGetTransactionsListRequest>,
    options?: { projection?: Document },
    alert?: Alert | null
  ): Promise<CursorPaginationResponse<InternalTransaction>> {
    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const filter = this.getTransactionsMongoQuery(params, [], alert)
    return await cursorPaginate<InternalTransaction>(
      collection,
      filter,
      {
        pageSize: params.pageSize ? (params.pageSize as number) : 20,
        sortField: params.sortField || 'timestamp',
        fromCursorKey: params.start,
        sortOrder: params.sortOrder,
      },
      options?.projection
    )
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
        .aggregate<{ _id: string }>([
          { $match: { type: 'TRANSACTION', tag: { $ne: null } } },
          { $group: { _id: '$tag' } },
        ])
        .toArray()

      return uniqueTags.map((doc) => doc._id)
    }
    if (params.field === 'TAGS_VALUE') {
      const uniqueTagsCollection = db.collection(
        UNIQUE_TAGS_COLLECTION(this.tenantId)
      )
      const pipeline: Document[] = [
        {
          $match: {
            type: 'TRANSACTION',
            ...(params.filter ? { tag: params.filter } : {}),
            value: { $ne: null },
          },
        },
        { $group: { _id: '$value' } },
        { $limit: 100 },
      ]

      const uniqueTags = await uniqueTagsCollection
        .aggregate<{ _id: string }>(pipeline)
        .toArray()

      return uniqueTags.map((doc) => doc._id)
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
      case '314A_INDIVIDUAL':
        fieldPath = '314A_INDIVIDUAL'
        break
      case '314A_BUSINESS':
        fieldPath = '314A_BUSINESS'
        break
      case 'TRANSACTION_TYPES':
        fieldPath = 'type'
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
    params: DefaultApiGetTransactionsStatsByTypeRequest,
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
      [key in string | 'null']?: {
        amounts: number[]
        min: number | null
        max: number | null
      }
    } = {}

    const cursor = collection.find(query, {
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
      const amounts = acc?.amounts ?? []
      amounts.sort((x, y) => x - y)
      const count = amounts.length
      const sum = amounts.reduce((acc: number, x) => acc + (x ?? 0), 0)
      return {
        transactionType:
          transactionType === 'null' ? undefined : (transactionType as string),
        count,
        sum,
        average: sum / count || 0,
        min: acc?.min ?? 0,
        max: acc?.max ?? 0,
        median:
          (count % 2 === 1
            ? amounts[(count - 1) / 2]
            : (amounts[count / 2] + amounts[count / 2 - 1]) / 2) || 0,
      }
    })
  }

  public async getStatsByTime(
    params: DefaultApiGetTransactionsStatsByTimeRequest,
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
      seriesFormat = 'YYYY/MM/01 00:00 Z' // Start of the month
      labelFormat = 'YYYY/MM'
    } else if (dur.asDays() > 1) {
      seriesFormat = 'YYYY/MM/DD 00:00 Z' // Start of the day
      labelFormat = 'MM/DD'
    } else {
      seriesFormat = 'YYYY/MM/DD HH:00 Z' // Start of the hour
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

  public async getAmount(
    transaction: InternalTransaction,
    referenceCurrency: Currency
  ): Promise<number> {
    let amount = 0

    const currencyService = new CurrencyService(this.dynamoDb)

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
    entityData: EntityData | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    if (
      entityData &&
      (entityData.type === 'ADDRESS' ||
        entityData.type === 'NAME' ||
        entityData.type === 'EMAIL')
    ) {
      yield* this.getEntitySendingTransactionsGenerator(
        entityData,
        timeRange,
        filterOptions,
        attributesToFetch
      )
    }

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

  public async *getEntitySendingTransactionsGenerator(
    entityData: EntityData,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    if (entityData.type === 'ADDRESS') {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          {
            $match: {
              [`originPaymentDetails.address`]: { $eq: entityData.address },
            },
          },
        ],
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else if (entityData.type === 'NAME') {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          {
            $match: {
              $or: [
                { [`originPaymentDetails.name`]: { $eq: entityData.name } },
                {
                  [`originPaymentDetails.nameOnCard`]: { $eq: entityData.name },
                },
              ],
            },
          },
        ],
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else if (entityData.type === 'EMAIL') {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          {
            $match: {
              [`originPaymentDetails.emailId`]: { $eq: entityData.email },
            },
          },
        ],
        timeRange,
        filterOptions,
        attributesToFetch
      )
    }
  }

  public async *getEntityReceivingTransactionsGenerator(
    entityData: EntityData,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    if (entityData.type === 'ADDRESS') {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          {
            $match: {
              $or: [
                {
                  [`destinationPaymentDetails.address`]: {
                    $eq: entityData.address,
                  },
                },
                {
                  [`destinationPaymentDetails.shippingAddress`]: {
                    $eq: entityData.address,
                  },
                },
                {
                  [`destinationPaymentDetails.bankAddress`]: {
                    $eq: entityData.address,
                  },
                },
              ],
            },
          },
        ],
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else if (entityData.type === 'NAME') {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          {
            $match: {
              $or: [
                {
                  [`destinationPaymentDetails.name`]: { $eq: entityData.name },
                },
                {
                  [`destinationPaymentDetails.nameOnCard`]: {
                    $eq: entityData.name,
                  },
                },
              ],
            },
          },
        ],
        timeRange,
        filterOptions,
        attributesToFetch
      )
    } else if (entityData.type === 'EMAIL') {
      yield* this.getRulesEngineTransactionsGenerator(
        [
          {
            $match: {
              [`destinationPaymentDetails.emailId`]: { $eq: entityData.email },
            },
          },
        ],
        timeRange,
        filterOptions,
        attributesToFetch
      )
    }
  }

  public async *getGenericUserReceivingTransactionsGenerator(
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    entityData: EntityData | undefined,
    timeRange: TimeRange,
    filterOptions: TransactionsFilterOptions,
    attributesToFetch: Array<keyof AuxiliaryIndexTransaction>,
    matchPaymentMethodDetails?: boolean
  ): AsyncGenerator<Array<AuxiliaryIndexTransaction>> {
    if (
      entityData &&
      (entityData.type === 'ADDRESS' ||
        entityData.type === 'NAME' ||
        entityData.type === 'EMAIL')
    ) {
      yield* this.getEntityReceivingTransactionsGenerator(
        entityData,
        timeRange,
        filterOptions,
        attributesToFetch
      )
    }
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

  public async *getUniqueUserIdGenerator(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange: TimeRange,
    chunkSize: number
  ): AsyncGenerator<string[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)
    const userField =
      direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
    const cursor = collection
      .aggregate(
        [
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
        ],
        { allowDiskUse: true }
      )
      .batchSize(chunkSize * 2)
    let results: string[] = []
    for await (const idData of cursor) {
      results.push(idData._id)

      if (results.length >= chunkSize) {
        yield results
        results = []
      }
    }
    if (results.length > 0) {
      yield results
    }
  }

  public async *getUniqueAddressDetailsGenerator(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange: TimeRange,
    chunkSize: number
  ): AsyncGenerator<Address[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const paymentDetailsField =
      direction === 'ORIGIN'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'

    // Address field mapping for each payment method
    const ADDRESS_FIELD_MAPPING: Record<PaymentMethod, string | undefined> = {
      CHECK: 'shippingAddress',
      CASH: 'address',
      NPP: 'address',
      GENERIC_BANK_ACCOUNT: 'address',
      MPESA: 'address',
      CARD: 'address',
      SWIFT: 'address',
      IBAN: 'bankAddress',
      ACH: 'bankAddress',
      UPI: undefined,
      WALLET: undefined,
    }

    // Address fields to extract from Address object
    const ADDRESS_FIELDS: (keyof Address)[] = [
      'addressLines',
      'postcode',
      'city',
      'state',
      'country',
    ]

    const globalBatch: Address[] = []
    for (const paymentMethod of PAYMENT_METHODS) {
      const addressField = ADDRESS_FIELD_MAPPING[paymentMethod]

      // Skip payment methods that don't have address fields
      if (addressField == null) {
        continue
      }

      const cursor = collection
        .aggregate(
          [
            {
              $match: {
                timestamp: {
                  $gte: timeRange.afterTimestamp,
                  $lt: timeRange.beforeTimestamp,
                },
                [paymentDetailsField]: { $exists: true },
                [`${paymentDetailsField}.method`]: paymentMethod,
                [`${paymentDetailsField}.${addressField}`]: {
                  $exists: true,
                  $ne: null,
                },
              },
            },
            {
              $group: {
                _id: ADDRESS_FIELDS.map(
                  (field) => `$${paymentDetailsField}.${addressField}.${field}`
                ),
              },
            },
          ],
          { allowDiskUse: true }
        )
        .batchSize(chunkSize * 2)
      for await (const data of cursor) {
        const addressData = Object.fromEntries(
          ADDRESS_FIELDS.map((field, index) => [field, data._id[index]])
        )

        // Filter out null/undefined values and reconstruct the Address object
        const filteredAddress: Partial<Address> = {}
        Object.entries(addressData).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            filteredAddress[key as keyof Address] = value
          }
        })

        // Ensure addressLines is defined and not empty
        if (
          !filteredAddress ||
          !filteredAddress.addressLines ||
          filteredAddress.addressLines.length === 0
        ) {
          continue
        }
        globalBatch.push(filteredAddress as Address)
        if (globalBatch.length >= chunkSize) {
          yield globalBatch.splice(0)
        }
      }
    }

    if (globalBatch.length > 0) {
      yield globalBatch
    }
  }

  public async *getUniqueNameDetailsGenerator(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange: TimeRange,
    chunkSize: number
  ): AsyncGenerator<(ConsumerName | string)[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const paymentDetailsField =
      direction === 'ORIGIN'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'

    // Name field mapping for each payment method
    const NAME_FIELD_MAPPING: Record<PaymentMethod, string> = {
      CHECK: 'name',
      CASH: 'name',
      NPP: 'name',
      GENERIC_BANK_ACCOUNT: 'name',
      MPESA: 'name',
      IBAN: 'name',
      ACH: 'name',
      SWIFT: 'name',
      UPI: 'name',
      WALLET: 'name',
      CARD: 'nameOnCard',
    }

    // Name fields to extract from ConsumerName object
    const NAME_FIELDS = ['firstName', 'middleName', 'lastName']

    const globalBatch: (ConsumerName | string)[] = []
    for (const paymentMethod of PAYMENT_METHODS) {
      const nameField = NAME_FIELD_MAPPING[paymentMethod]

      // For CARD payment method, extract individual name fields
      if (paymentMethod === 'CARD') {
        const cursor = collection
          .aggregate(
            [
              {
                $match: {
                  timestamp: {
                    $gte: timeRange.afterTimestamp,
                    $lt: timeRange.beforeTimestamp,
                  },
                  [paymentDetailsField]: { $exists: true },
                  [`${paymentDetailsField}.method`]: paymentMethod,
                  [`${paymentDetailsField}.${nameField}`]: {
                    $exists: true,
                    $ne: null,
                  },
                },
              },
              {
                $group: {
                  _id: NAME_FIELDS.map(
                    (field) => `$${paymentDetailsField}.${nameField}.${field}`
                  ),
                },
              },
            ],
            { allowDiskUse: true }
          )
          .batchSize(chunkSize * 2)
        for await (const data of cursor) {
          const nameData = data._id

          // Reconstruct the ConsumerName from array of fields
          if (Array.isArray(nameData)) {
            const filteredName: Partial<ConsumerName> = {}
            NAME_FIELDS.forEach((field, index) => {
              const value = nameData[index]
              if (value !== null && value !== undefined) {
                filteredName[field as keyof ConsumerName] = value as string
              }
            })

            // Ensure firstName is present (required field)
            if (!filteredName || !filteredName.firstName) {
              continue
            }
            globalBatch.push(filteredName as ConsumerName)
            if (globalBatch.length >= chunkSize) {
              yield globalBatch.splice(0)
            }
          }
        }
      } else {
        // For other payment methods, extract the entire name field as string
        const cursor = collection
          .aggregate(
            [
              {
                $match: {
                  timestamp: {
                    $gte: timeRange.afterTimestamp,
                    $lt: timeRange.beforeTimestamp,
                  },
                  [paymentDetailsField]: { $exists: true },
                  [`${paymentDetailsField}.method`]: paymentMethod,
                  [`${paymentDetailsField}.${nameField}`]: {
                    $exists: true,
                    $ne: null,
                  },
                },
              },
              {
                $group: {
                  _id: `$${paymentDetailsField}.${nameField}`,
                },
              },
            ],
            { allowDiskUse: true }
          )
          .batchSize(chunkSize * 2)
        for await (const data of cursor) {
          const nameData = data._id
          if (typeof nameData === 'string' && nameData) {
            globalBatch.push(nameData)
            if (globalBatch.length >= chunkSize) {
              yield globalBatch.splice(0)
            }
          }
        }
      }
    }

    if (globalBatch.length > 0) {
      yield globalBatch
    }
  }

  public async *getUniqueEmailDetailsGenerator(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange: TimeRange,
    chunkSize: number
  ): AsyncGenerator<string[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const paymentDetailsField =
      direction === 'ORIGIN'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'

    const cursor = collection
      .aggregate(
        [
          {
            $match: {
              timestamp: {
                $gte: timeRange.afterTimestamp,
                $lt: timeRange.beforeTimestamp,
              },
              [paymentDetailsField]: { $exists: true },
              [`${paymentDetailsField}.emailId`]: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: `$${paymentDetailsField}.emailId`,
            },
          },
        ],
        { allowDiskUse: true }
      )
      .batchSize(chunkSize * 2)
    const results: string[] = []
    for await (const data of cursor) {
      const email = data._id
      if (email === null || email === undefined) {
        continue
      }
      results.push(email)
      if (results.length >= chunkSize) {
        yield results.splice(0)
      }
    }
    if (results.length > 0) {
      yield results
    }
  }

  public async *getUniquePaymentDetailsGenerator(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange: TimeRange,
    chunkSize: number
  ): AsyncGenerator<PaymentDetails[]> {
    const db = this.mongoDb.db()
    const name = TRANSACTIONS_COLLECTION(this.tenantId)
    const collection = db.collection<InternalTransaction>(name)

    const paymentDetailsField =
      direction === 'ORIGIN'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'
    const globalBatch: PaymentDetails[] = []
    for (const paymentMethod in PAYMENT_METHOD_IDENTIFIER_FIELDS) {
      const paymentIdentifiers =
        PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentMethod as PaymentMethod]
      const cursor = collection
        .aggregate(
          [
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
          ],
          { allowDiskUse: true }
        )

        .batchSize(chunkSize * 2)
      for await (const v of cursor) {
        const details: PaymentDetails = {
          method: paymentMethod,
          ...Object.fromEntries(
            paymentIdentifiers.map((field, index) => [field, v._id[index]])
          ),
        }

        globalBatch.push(details)

        if (globalBatch.length >= chunkSize) {
          yield globalBatch.splice(0)
        }
      }
    }
    if (globalBatch.length > 0) {
      yield globalBatch
    }
  }

  /**
   * Helper to build address filter from Address object.
   */

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

    const uniqueTags = uniq(
      transaction.tags.map((tag) =>
        JSON.stringify({ key: tag.key, value: tag.value })
      )
    ).map((uniqueStr) => JSON.parse(uniqueStr))

    await Promise.all(
      uniqueTags.map((tag) =>
        uniqueTagsCollection.updateOne(
          { tag: tag.key, value: tag.value, type: 'TRANSACTION' },
          { $set: { tag: tag.key, value: tag.value, type: 'TRANSACTION' } },
          { upsert: true }
        )
      )
    )
  }
}
