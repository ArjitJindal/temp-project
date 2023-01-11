import { v4 as uuidv4 } from 'uuid'
import {
  AggregationCursor,
  Document,
  Filter,
  MongoClient,
  UpdateResult,
} from 'mongodb'
import _ from 'lodash'
import { NotFound } from 'http-errors'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import {
  CASES_COLLECTION,
  COUNTER_COLLECTION,
  paginatePipeline,
  TRANSACTION_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { CasePriority } from '@/@types/openapi-internal/CasePriority'
import { CASE_PRIORITY } from '@/@types/case/case-priority'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { Tag } from '@/@types/openapi-public/Tag'
import { CaseTransactionsListResponse } from '@/@types/openapi-internal/CaseTransactionsListResponse'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { RulesHitPerCase } from '@/@types/openapi-internal/RulesHitPerCase'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import {
  getRiskLevelFromScore,
  getRiskScoreBoundsFromLevel,
} from '@/services/risk-scoring/utils'
import { hasFeature } from '@/core/utils/context'
import {
  PaginationParams,
  OptionalPagination,
  COUNT_QUERY_LIMIT,
} from '@/utils/pagination'

export const MAX_TRANSACTION_IN_A_CASE = 1000

export class CaseRepository {
  mongoDb: MongoClient
  tenantId: string
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: {
      mongoDb?: MongoClient
      dynamoDb?: DynamoDBDocumentClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
  }

  static getPriority(
    ruleCasePriority: ReadonlyArray<CasePriority>
  ): CasePriority {
    return ruleCasePriority.reduce((prev, curr) => {
      if (CASE_PRIORITY.indexOf(curr) < CASE_PRIORITY.indexOf(prev)) {
        return curr
      } else {
        return prev
      }
    }, CASE_PRIORITY[CASE_PRIORITY.length - 1])
  }

  async addCaseMongo(caseEntity: Case): Promise<Case> {
    const db = this.mongoDb.db()
    const session = this.mongoDb.startSession()
    try {
      await session.withTransaction(async () => {
        const casesCollection = db.collection<Case>(
          CASES_COLLECTION(this.tenantId)
        )
        if (!caseEntity.caseId) {
          const counterCollection = db.collection<EntityCounter>(
            COUNTER_COLLECTION(this.tenantId)
          )
          const caseCount = (
            await counterCollection.findOneAndUpdate(
              { entity: 'Case' },
              { $inc: { count: 1 } },
              { upsert: true, returnDocument: 'after' }
            )
          ).value
          caseEntity._id = caseCount?.count
          caseEntity.caseId = `C-${caseEntity._id}`
        }
        await casesCollection.replaceOne(
          { caseId: caseEntity.caseId },
          caseEntity,
          { upsert: true }
        )
      })
      return caseEntity
    } finally {
      await session.endSession()
    }
  }

  private async getCasesMongoQuery(
    params: OptionalPagination<DefaultApiGetCaseListRequest>
  ): Promise<{ filter: Filter<Case> }> {
    const conditions: Filter<Case>[] = []
    conditions.push({
      createdTimestamp: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      },
    })

    if (
      params.beforeTransactionTimestamp != null &&
      params.afterTransactionTimestamp != null
    ) {
      conditions.push({
        'caseTransactions.timestamp': {
          $lte: params.beforeTransactionTimestamp,
          $gte: params.afterTransactionTimestamp,
        },
      })
    }

    if (params.filterId != null) {
      conditions.push({ caseId: { $regex: params.filterId, $options: 'i' } })
    }
    if (params.transactionType != null) {
      conditions.push({
        'caseTransactions.type': {
          $regex: params.transactionType,
          $options: 'i',
        },
      })
    }
    if (params.filterOutStatus != null) {
      conditions.push({
        'caseTransactions.status': { $ne: params.filterOutStatus },
      })
    }
    if (params.filterOutCaseStatus != null) {
      conditions.push({ caseStatus: { $ne: params.filterOutCaseStatus } })
    }
    if (params.filterTransactionState != null) {
      conditions.push({
        'caseTransactions.transactionState': {
          $in: params.filterTransactionState,
        },
      })
    }
    if (params.filterStatus != null) {
      conditions.push({
        'caseTransactions.status': { $in: params.filterStatus },
      })
    }

    if (params.filterUserKYCStatus != null) {
      conditions.push({
        $or: [
          {
            'caseUsers.origin.kycStatusDetails.status': {
              $in: params.filterUserKYCStatus,
            },
          },
          {
            'caseUsers.destination.kycStatusDetails.status': {
              $in: params.filterUserKYCStatus,
            },
          },
        ],
      })
    }

    if (params.filterUserState != null) {
      conditions.push({
        $or: [
          {
            'caseUsers.origin.userStateDetails.state': {
              $in: params.filterUserState,
            },
          },
          {
            'caseUsers.destination.userStateDetails.state': {
              $in: params.filterUserState,
            },
          },
        ],
      })
    }

    if (params.filterRiskLevel != null && (await hasFeature('PULSE'))) {
      const riskRepository = new RiskRepository(this.tenantId, {
        dynamoDb: this.dynamoDb,
      })

      const riskClassificationValues =
        await riskRepository.getRiskClassificationValues()

      conditions.push({
        $or: params.filterRiskLevel.map((riskLevel) => {
          const { lowerBoundRiskScore, upperBoundRiskScore } =
            getRiskScoreBoundsFromLevel(riskClassificationValues, riskLevel)
          return {
            $or: [
              {
                'caseUsers.originUserDrsScore': {
                  $gte: lowerBoundRiskScore,
                  $lte: upperBoundRiskScore,
                },
              },
              {
                'caseUsers.destinationUserDrsScore': {
                  $gte: lowerBoundRiskScore,
                  $lte: upperBoundRiskScore,
                },
              },
            ],
          }
        }),
      })
    }

    if (params.filterCaseStatus != null) {
      conditions.push({ caseStatus: { $eq: params.filterCaseStatus } })
    }
    if (params.filterUserId != null) {
      conditions.push({
        $or: [
          { 'caseUsers.origin.userId': { $eq: params.filterUserId } },
          { 'caseUsers.destination.userId': { $eq: params.filterUserId } },
        ],
      })
    } else {
      if (params.filterOriginUserId != null) {
        conditions.push({
          'caseUsers.origin.userId': { $eq: params.filterOriginUserId },
        })
      }
      if (params.filterDestinationUserId != null) {
        conditions.push({
          'caseUsers.destination.userId': {
            $eq: params.filterDestinationUserId,
          },
        })
      }
    }

    if (params.filterTransactionId != null) {
      conditions.push({
        'caseTransactions.transactionId': { $eq: params.filterTransactionId },
      })
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
          ruleInstanceId: { $in: params.filterRulesHit },
        },
      })
    }
    if (executedRulesFilters.length > 0) {
      conditions.push({
        'caseTransactions.executedRules': {
          $all: executedRulesFilters,
        },
      })
    }

    if (params.filterOriginCurrencies != null) {
      conditions.push({
        'caseTransactions.originAmountDetails.transactionCurrency': {
          $in: params.filterOriginCurrencies,
        },
      })
    }
    if (params.filterDestinationCurrencies != null) {
      conditions.push({
        'caseTransactions.destinationAmountDetails.transactionCurrency': {
          $in: params.filterDestinationCurrencies,
        },
      })
    }
    if (params.filterOriginPaymentMethod != null) {
      conditions.push({
        'caseTransactions.originPaymentDetails.method': {
          $eq: params.filterOriginPaymentMethod,
        },
      })
    }
    if (params.filterDestinationPaymentMethod != null) {
      conditions.push({
        'caseTransactions.destinationPaymentDetails.method': {
          $eq: params.filterDestinationPaymentMethod,
        },
      })
    }

    if (params.filterTransactionAmoutAbove != null) {
      conditions.push({
        $or: [
          {
            'caseTransactions.originAmountDetails.transactionAmount': {
              $gte: params.filterTransactionAmoutAbove,
            },
          },
          {
            'caseTransactions.destinationAmountDetails.transactionAmount': {
              $gte: params.filterTransactionAmoutAbove,
            },
          },
        ],
      })
    }

    if (params.filterTransactionAmoutBelow != null) {
      conditions.push({
        $or: [
          {
            'caseTransactions.originAmountDetails.transactionAmount': {
              $lte: params.filterTransactionAmoutBelow,
            },
          },
          {
            'caseTransactions.destinationAmountDetails.transactionAmount': {
              $lte: params.filterTransactionAmoutBelow,
            },
          },
        ],
      })
    }

    if (params.filterOriginCountry != null) {
      conditions.push({
        'caseTransactions.originAmountDetails.country': {
          $eq: params.filterOriginCountry,
        },
      })
    }

    if (params.filterDestinationCountry != null) {
      conditions.push({
        'caseTransactions.destinationAmountDetails.country': {
          $eq: params.filterDestinationCountry,
        },
      })
    }

    if (params.filterCaseType != null) {
      conditions.push({
        caseType: {
          $eq: params.filterCaseType,
        },
      })
    }
    if (params.filterPriority != null) {
      conditions.push({
        priority: {
          $eq: params.filterPriority,
        },
      })
    }
    if (params.filterTransactionTagKey || params.filterTransactionTagValue) {
      const elemCondition: { [attr: string]: Filter<Tag> } = {}
      if (params.filterTransactionTagKey) {
        elemCondition['key'] = { $eq: params.filterTransactionTagKey }
      }
      if (params.filterTransactionTagValue) {
        elemCondition['value'] = {
          $regex: params.filterTransactionTagValue,
          $options: 'i',
        }
      }
      conditions.push({
        'caseTransactions.tags': {
          $elemMatch: elemCondition,
        },
      })
    }
    if (params.filterBusinessIndustries != null) {
      conditions.push({
        $or: [
          {
            'caseUsers.origin.legalEntity.companyGeneralDetails.businessIndustry':
              {
                $in: params.filterBusinessIndustries,
              },
          },
          {
            'caseUsers.destination.legalEntity.companyGeneralDetails.businessIndustry':
              {
                $in: params.filterBusinessIndustries,
              },
          },
        ],
      })
    }
    return {
      filter: { $and: conditions },
    }
  }

  public async getCasesMongoPipeline(
    params: OptionalPagination<DefaultApiGetCaseListRequest>
  ): Promise<{
    // Pipeline stages to be run before `limit`
    preLimitPipeline: Document[]
    // Pipeline stages to be run after `limit` - for augmentation-purpose only. The fields
    // added here cannot be filtered / sorted.
    postLimitPipeline: Document[]
  }> {
    const sortField =
      params?.sortField !== undefined && params?.sortField !== 'undefined'
        ? params?.sortField
        : 'createdTimestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const { filter } = await this.getCasesMongoQuery(params)

    const preLimitPipeline: Document[] = []
    const postLimitPipeline: Document[] = []

    preLimitPipeline.push({ $match: filter })

    const sortUserCaseUserName =
      params?.filterCaseType === 'USER' && params.sortField === '_userName'
    const sortTransactionCaseUserName =
      params?.filterCaseType === 'TRANSACTION' &&
      (params.sortField === '_originUserName' ||
        params.sortField === '_destinationUserName')
    const sortCaseTransactionsHit = params.sortField === '_transactionsHit'
    if (params?.includeTransactionUsers || sortTransactionCaseUserName) {
      // NOTE: we don't store originUser/destinationUser in caseTransactions. Sorting by
      // user name will not be performant
      ;(sortTransactionCaseUserName
        ? preLimitPipeline
        : postLimitPipeline
      ).push(
        ...[
          {
            $lookup: {
              from: USERS_COLLECTION(this.tenantId),
              localField: 'caseTransactions.originUserId',
              foreignField: 'userId',
              as: '_originUsers',
            },
          },
          {
            $lookup: {
              from: USERS_COLLECTION(this.tenantId),
              localField: 'caseTransactions.destinationUserId',
              foreignField: 'userId',
              as: '_destinationUsers',
            },
          },
          {
            $set: {
              caseTransactions: {
                $map: {
                  input: '$caseTransactions',
                  as: 'transaction',
                  in: {
                    $mergeObjects: [
                      '$$transaction',
                      {
                        originUser: {
                          $first: {
                            $filter: {
                              input: '$_originUsers',
                              as: 'user',
                              cond: {
                                $eq: [
                                  '$$user.userId',
                                  '$$transaction.originUserId',
                                ],
                              },
                            },
                          },
                        },
                        destinationUser: {
                          $first: {
                            $filter: {
                              input: '$_destinationUsers',
                              as: 'user',
                              cond: {
                                $eq: [
                                  '$$user.userId',
                                  '$$transaction.destinationUserId',
                                ],
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          {
            $project: {
              _originUsers: false,
              _destinationUsers: false,
            },
          },
        ]
      )
    }

    if (sortUserCaseUserName) {
      preLimitPipeline.push(
        ...[
          {
            $set: {
              _userName: {
                $ifNull: [
                  {
                    $ifNull: [
                      {
                        $concat: [
                          '$caseUsers.origin.userDetails.name.firstName',
                          '$caseUsers.origin.userDetails.name.middleName',
                          '$caseUsers.origin.userDetails.name.lastName',
                        ],
                      },
                      {
                        $concat: [
                          '$caseUsers.destination.userDetails.name.firstName',
                          '$caseUsers.destination.userDetails.name.middleName',
                          '$caseUsers.destination.userDetails.name.lastName',
                        ],
                      },
                    ],
                  },
                  {
                    $ifNull: [
                      '$caseUsers.destination.legalEntity.companyGeneralDetails.legalName',
                      '$caseUsers.origin.legalEntity.companyGeneralDetails.legalName',
                    ],
                  },
                ],
              },
            },
          },
        ]
      )
    } else if (sortTransactionCaseUserName) {
      const sortField =
        params.sortField === '_originUserName' ? 'origin' : 'destination'

      preLimitPipeline.push(
        ...[
          {
            $set: {
              caseTransaction: {
                $arrayElemAt: ['$caseTransactions', 0],
              },
            },
          },
          {
            $set: {
              caseTransactionCompanyName: `$caseTransaction.${sortField}User.legalEntity.companyGeneralDetails.legalName`,
              caseTransactionUserName: {
                $concat: [
                  `$caseTransaction.${sortField}User.userDetails.name.firstName`,
                  `$caseTransaction.${sortField}User.userDetails.name.lastName`,
                ],
              },
            },
          },
          {
            $set: {
              [`_${sortField}UserName`]: {
                $ifNull: [
                  '$caseTransactionCompanyName',
                  '$caseTransactionUserName',
                ],
              },
            },
          },
        ]
      )
    } else if (sortCaseTransactionsHit) {
      preLimitPipeline.push(
        ...[
          {
            $set: {
              _transactionsHit: {
                $size: '$caseTransactionsIds',
              },
            },
          },
        ]
      )
    }

    preLimitPipeline.push({ $sort: { [sortField]: sortOrder, _id: 1 } })
    preLimitPipeline.push({
      $project: {
        _originUserName: false,
        _destinationUserName: false,
        _userName: false,
      },
    })

    if (params?.includeTransactionEvents) {
      postLimitPipeline.push(
        ...[
          {
            $lookup: {
              from: TRANSACTION_EVENTS_COLLECTION(this.tenantId),
              localField: 'caseTransactions.transactionId',
              foreignField: 'transactionId',
              as: '_events',
            },
          },
          {
            $set: {
              caseTransactions: {
                $map: {
                  input: '$caseTransactions',
                  as: 'transaction',
                  in: {
                    $mergeObjects: [
                      '$$transaction',
                      {
                        events: {
                          $filter: {
                            input: '$_events',
                            as: 'event',
                            cond: {
                              $eq: [
                                '$$event.transactionId',
                                '$$transaction.transactionId',
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          {
            $project: {
              _events: false,
            },
          },
        ]
      )
    }

    if (!params.includeTransactions) {
      postLimitPipeline.push({ $unset: 'caseTransactions' })
    }

    return { preLimitPipeline, postLimitPipeline }
  }

  public async getCasesCursor(
    params: OptionalPagination<DefaultApiGetCaseListRequest>
  ): Promise<AggregationCursor<Case>> {
    const { preLimitPipeline, postLimitPipeline } =
      await this.getCasesMongoPipeline(params)
    preLimitPipeline.push(...paginatePipeline(params))
    return this.getDenormalizedCases(preLimitPipeline.concat(postLimitPipeline))
  }

  private getDenormalizedCases(pipeline: Document[]) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return collection.aggregate<Case>(pipeline, { allowDiskUse: true })
  }

  public async getCasesCount(
    params: DefaultApiGetCaseListRequest
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const { preLimitPipeline, postLimitPipeline } =
      await this.getCasesMongoPipeline(params)
    const pipeline = preLimitPipeline.concat(postLimitPipeline)
    pipeline.push({
      $limit: COUNT_QUERY_LIMIT,
    })
    pipeline.push({
      $count: 'count',
    })
    const result: AggregationCursor<{ count: number }> =
      await collection.aggregate(pipeline, { allowDiskUse: true })
    const item = await result.next()
    return item?.count ?? 0
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest
  ): Promise<{ total: number; data: Case[] }> {
    let cursor = await this.getCasesCursor(params)
    const total = this.getCasesCount(params)

    if (await hasFeature('PULSE')) {
      const riskRepository = new RiskRepository(this.tenantId, {
        dynamoDb: this.dynamoDb,
      })

      const riskClassification =
        await riskRepository.getRiskClassificationValues()

      cursor = cursor.map((caseItem) => {
        let originUserRiskLevel
        let destinationUserRiskLevel

        if (caseItem?.caseUsers?.originUserDrsScore != null) {
          originUserRiskLevel = getRiskLevelFromScore(
            riskClassification,
            caseItem.caseUsers.originUserDrsScore
          )

          caseItem.caseUsers.originUserRiskLevel = originUserRiskLevel
        }

        if (caseItem?.caseUsers?.destinationUserDrsScore != null) {
          destinationUserRiskLevel = getRiskLevelFromScore(
            riskClassification,
            caseItem.caseUsers.destinationUserDrsScore
          )

          caseItem.caseUsers.destinationUserRiskLevel = destinationUserRiskLevel
        }

        delete caseItem?.caseUsers?.originUserDrsScore
        delete caseItem?.caseUsers?.destinationUserDrsScore

        return caseItem
      })
    }
    return { total: await total, data: await cursor.toArray() }
  }

  public async updateCases(
    caseIds: string[],
    updates: {
      assignments?: Assignment[]
      statusChange?: CaseStatusChange
      caseStatus?: CaseStatus
    }
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    await collection.updateMany(
      { caseId: { $in: caseIds } },
      {
        $set: _.omitBy<Partial<Case>>(
          {
            assignments: updates.assignments,
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

  public async saveCaseComment(
    caseId: string,
    comment: Comment
  ): Promise<Comment> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const commentToSave: Comment = {
      ...comment,
      id: comment.id || uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await collection.updateOne(
      {
        caseId,
      },
      {
        $push: { comments: commentToSave },
      }
    )
    return commentToSave
  }

  public async deleteCaseComment(caseId: string, commentId: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    await collection.updateOne(
      {
        caseId,
      },
      {
        $pull: { comments: { id: commentId } },
      }
    )
  }

  public async getCaseById(
    caseId: string,
    params: {
      includeTransactions?: boolean
      includeTransactionEvents?: boolean
      includeTransactionUsers?: boolean
    } = {}
  ): Promise<Case | null> {
    const { data } = await this.getCases({
      filterId: `^${caseId}$`,
      includeTransactions: params.includeTransactions ?? false,
      includeTransactionEvents: params.includeTransactionEvents ?? false,
      includeTransactionUsers: params.includeTransactionUsers ?? false,
      page: 1,
      pageSize: 1,
    })
    if (data.length === 0) {
      return null
    }
    return data[0]
  }

  public async getCaseTransactions(
    caseId: string,
    params: PaginationParams & {
      includeUsers?: boolean
    }
  ): Promise<CaseTransactionsListResponse> {
    const transactionsRepo = new TransactionRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    const caseItem = await this.getCaseById(caseId)
    if (caseItem == null) {
      throw new NotFound(`Case not found: ${caseId}`)
    }
    const caseTransactionsIds = caseItem.caseTransactionsIds
    if (caseTransactionsIds == null) {
      return {
        total: 0,
        data: [],
      }
    }

    // TODO: Don't use transactionsRepo.getTransactions and handle params.includeUsers here
    return await transactionsRepo.getTransactions({
      filterIdList: caseTransactionsIds,
      afterTimestamp: 0,
      beforeTimestamp: Number.MAX_SAFE_INTEGER,
      page: params.page,
      pageSize: params.pageSize,
      includeUsers: params.includeUsers,
    })
  }
  private getCaseRulesMongoPipeline(caseFilter: string) {
    return [
      {
        $match: {
          caseId: { $regex: caseFilter, $options: 'i' },
        },
      },
      {
        $project: {
          caseTransactions: 1,
          caseId: 1,
        },
      },
      {
        $unwind: {
          path: '$caseTransactions',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $unwind: {
          path: '$caseTransactions.hitRules',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: '$caseTransactions.hitRules.ruleInstanceId',
          transactionsCount: {
            $sum: 1,
          },
          ruleName: {
            $first: '$caseTransactions.hitRules.ruleName',
          },
          ruleAction: {
            $first: '$caseTransactions.hitRules.ruleAction',
          },
          ruleDescription: {
            $first: '$caseTransactions.hitRules.ruleDescription',
          },
          ruleInstanceId: {
            $first: '$caseTransactions.hitRules.ruleInstanceId',
          },
          ruleId: {
            $first: '$caseTransactions.hitRules.ruleId',
          },
        },
      },
    ]
  }

  private getCaseRulesCursor(caseFilter: string) {
    const pipeline = this.getCaseRulesMongoPipeline(caseFilter)

    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return collection.aggregate<RulesHitPerCase>(pipeline, {
      allowDiskUse: true,
    })
  }

  public async getCaseRules(caseId: string): Promise<Array<RulesHitPerCase>> {
    const caseFilter = `^${caseId}$`
    const cursor = this.getCaseRulesCursor(caseFilter)
    return await cursor.toArray()
  }

  private getCaseRuleTransactionsMongoPipeline(
    caseFilter: string,
    ruleFilter: string
  ) {
    return [
      {
        $match: {
          caseId: { $regex: caseFilter, $options: 'i' },
        },
      },
      {
        $project: {
          caseTransactions: 1,
        },
      },
      {
        $unwind: {
          path: '$caseTransactions',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $unwind: {
          path: '$caseTransactions.hitRules',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          'caseTransactions.hitRules.ruleInstanceId': {
            $regex: ruleFilter,
            $options: 'i',
          },
        },
      },
      {
        $lookup: {
          from: USERS_COLLECTION(this.tenantId),
          localField: 'caseTransactions.originUserId',
          foreignField: 'userId',
          as: 'originUser',
        },
      },
      {
        $lookup: {
          from: USERS_COLLECTION(this.tenantId),
          localField: 'caseTransactions.destinationUserId',
          foreignField: 'userId',
          as: 'destinationUser',
        },
      },
      {
        $lookup: {
          from: TRANSACTION_EVENTS_COLLECTION(this.tenantId),
          localField: 'caseTransactions.transactionId',
          foreignField: 'transactionId',
          as: 'events',
        },
      },
      {
        $set: {
          'caseTransactions.originUser': { $first: '$originUser' },
          'caseTransactions.destinationUser': { $first: '$destinationUser' },
          'caseTransactions.events': '$events',
        },
      },
    ]
  }

  public getCaseRuleTransactionsCursor(
    caseFilter: string,
    ruleFilter: string,
    params: PaginationParams
  ) {
    const pipeline = this.getCaseRuleTransactionsMongoPipeline(
      caseFilter,
      ruleFilter
    )

    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return collection.aggregate<Case>(
      [
        ...pipeline,
        {
          $sort: { 'caseTransactions.timestamp': -1 },
        },
        ...paginatePipeline(params),
      ],
      {
        allowDiskUse: true,
      }
    )
  }

  public async getCaseRuleTransactionsCount(
    caseId: string,
    ruleInstanceId: string
  ): Promise<number> {
    const pipeline = this.getCaseRuleTransactionsMongoPipeline(
      caseId,
      ruleInstanceId
    )

    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const cursor = await collection.aggregate([
      ...pipeline,
      { $group: { _id: null, count: { $sum: 1 } } },
    ])
    const res = await cursor.next()
    return res?.count ?? 0
  }

  public async getCaseRuleTransactions(
    caseId: string,
    ruleInstanceId: string,
    params: PaginationParams
  ) {
    const caseFilter = `^${caseId}$`
    const ruleFilter = `^${ruleInstanceId}$`
    const cursor = this.getCaseRuleTransactionsCursor(
      caseFilter,
      ruleFilter,
      params
    )
    const res = await cursor.toArray()

    return {
      total: await this.getCaseRuleTransactionsCount(caseId, ruleInstanceId),
      cases: res,
    }
  }

  public async getCasesByTransactionId(
    transactionId: string,
    caseType: CaseType
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection
      .find({
        caseType,
        'caseTransactions.transactionId': transactionId,
      })
      .toArray()
  }

  public async getCasesByUserId(
    userId: string,
    params: {
      directions?: ('ORIGIN' | 'DESTINATION')[]
      filterCaseType: CaseType
      filterMaxTransactions?: number
      filterOutCaseStatus?: CaseStatus
    }
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const filters: Filter<Case>[] = []

    if (params.filterCaseType) {
      filters.push({
        caseType: params.filterCaseType,
      })
    }

    if (params.filterOutCaseStatus != null) {
      filters.push({
        caseStatus: { $ne: params.filterOutCaseStatus },
      })
    }

    if (params.filterMaxTransactions != null) {
      filters.push({
        [`caseTransactionsIds.${params.filterMaxTransactions - 1}`]: {
          $exists: false,
        },
      })
    }

    const directionFilters: Filter<Case>[] = []
    const { directions } = params
    if (directions == null || directions.includes('ORIGIN')) {
      directionFilters.push({
        'caseUsers.origin.userId': userId,
      })
    }
    if (directions == null || directions.includes('DESTINATION')) {
      directionFilters.push({
        'caseUsers.destination.userId': userId,
      })
    }
    if (directionFilters.length > 0) {
      filters.push({
        $or: directionFilters,
      })
    }

    return await casesCollection
      .find({
        $and: filters,
      })
      .toArray()
  }

  public async updateUsersInCases(user: User | Business) {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const userUpdatePromises: Promise<Document | UpdateResult>[] = []
    userUpdatePromises.push(
      casesCollection.updateMany(
        { 'caseUsers.origin.userId': user.userId },
        { $set: { 'caseUsers.origin': user } }
      )
    )
    userUpdatePromises.push(
      casesCollection.updateMany(
        { 'caseUsers.destination.userId': user.userId },
        { $set: { 'caseUsers.destination': user } }
      )
    )
    await Promise.all(userUpdatePromises)
  }

  public async getCasesByTransactionIds(
    transactionIds: string[],
    caseType: CaseType
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection
      .find({
        caseType,
        caseTransactionsIds: { $in: transactionIds },
      })
      .toArray()
  }

  public async getCasesByIds(caseIds: string[]): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection
      .find({
        caseId: { $in: caseIds },
      })
      .toArray()
  }

  public async updateDynamicRiskScores(
    transactionId: string,
    originDrsScore: number | undefined | null,
    destinationDrsScore: number | undefined | null
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    await collection.updateOne(
      { caseTransactionsIds: { $elemMatch: { $eq: transactionId } } },
      {
        $set: {
          'caseUsers.originUserDrsScore': originDrsScore,
          'caseUsers.destinationUserDrsScore': destinationDrsScore,
        },
      }
    )
  }
}
