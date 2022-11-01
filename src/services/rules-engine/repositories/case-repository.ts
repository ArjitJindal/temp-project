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
import {
  CASES_COLLECTION,
  COUNTER_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  TRANSACTIONS_COLLECTION,
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

export class CaseRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      mongoDb?: MongoClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
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

  private getCasesMongoQuery(params: DefaultApiGetCaseListRequest): {
    filter: Filter<Case>
    requiresTransactions: boolean
  } {
    let requiresTransactions = false
    const conditions: Filter<Case>[] = []
    conditions.push({
      createdTimestamp: {
        $gte: params.afterTimestamp || 0,
        $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      },
    })

    if (params.filterId != null) {
      conditions.push({ caseId: { $regex: params.filterId } })
    }
    if (params.transactionType != null) {
      conditions.push({
        'caseTransactions.type': { $regex: params.transactionType },
      })
      requiresTransactions = true
    }
    if (params.filterOutStatus != null) {
      conditions.push({
        'caseTransactions.status': { $ne: params.filterOutStatus },
      })
      requiresTransactions = true
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
      requiresTransactions = true
    }
    if (params.filterStatus != null) {
      conditions.push({
        'caseTransactions.status': { $in: params.filterStatus },
      })
      requiresTransactions = true
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
    if (executedRulesFilters.length > 0) {
      conditions.push({
        'caseTransactions.executedRules': {
          $all: executedRulesFilters,
        },
      })
      requiresTransactions = true
    }

    if (params.filterOriginCurrencies != null) {
      conditions.push({
        'caseTransactions.originAmountDetails.transactionCurrency': {
          $in: params.filterOriginCurrencies,
        },
      })
      requiresTransactions = true
    }
    if (params.filterDestinationCurrencies != null) {
      conditions.push({
        'caseTransactions.destinationAmountDetails.transactionCurrency': {
          $in: params.filterDestinationCurrencies,
        },
      })
      requiresTransactions = true
    }
    if (params.filterOriginPaymentMethod != null) {
      conditions.push({
        'caseTransactions.originPaymentDetails.method': {
          $eq: params.filterOriginPaymentMethod,
        },
      })
      requiresTransactions = true
    }
    if (params.filterDestinationPaymentMethod != null) {
      conditions.push({
        'caseTransactions.destinationPaymentDetails.method': {
          $eq: params.filterDestinationPaymentMethod,
        },
      })
      requiresTransactions = true
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
      requiresTransactions = true
    }
    return {
      filter: { $and: conditions },
      requiresTransactions,
    }
  }

  public getCasesMongoPipeline(
    params: DefaultApiGetCaseListRequest
  ): Document[] {
    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'createdTimestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const { filter, requiresTransactions: queryRequiresTransactions } =
      this.getCasesMongoQuery(params)

    const pipeline: Document[] = [{ $sort: { [sortField]: sortOrder } }]
    const requiresTransactions =
      queryRequiresTransactions ||
      params?.includeTransactions ||
      params?.includeTransactionUsers ||
      params?.includeTransactionEvents
    if (requiresTransactions) {
      pipeline.push(
        ...[
          {
            $lookup: {
              from: TRANSACTIONS_COLLECTION(this.tenantId),
              localField: 'caseTransactionsIds',
              foreignField: 'transactionId',
              as: 'caseTransactions',
            },
          },
        ]
      )
    }
    if (params?.includeTransactionUsers) {
      pipeline.push(
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
    if (params?.includeTransactionEvents) {
      pipeline.push(
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
    pipeline.push({ $match: filter })
    if (!params.includeTransactions) {
      pipeline.push({ $unset: 'caseTransactions' })
    }
    return pipeline
  }

  public getCasesCursor(
    params: DefaultApiGetCaseListRequest
  ): AggregationCursor<Case> {
    const pipeline = this.getCasesMongoPipeline(params)
    if (params?.skip) {
      pipeline.push({ $skip: params.skip })
    }
    if (params?.limit) {
      pipeline.push({ $limit: params.limit })
    }
    return this.getDenormalizedCases(pipeline)
  }

  private getDenormalizedCases(pipeline: Document[]) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return collection.aggregate<Case>(pipeline)
  }

  public async getCasesCount(
    params: DefaultApiGetCaseListRequest
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const pipeline = this.getCasesMongoPipeline(params)
    pipeline.push({
      $count: 'count',
    })
    const result: AggregationCursor<{ count: number }> =
      await collection.aggregate(pipeline)
    const item = await result.next()
    return item?.count ?? 0
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest
  ): Promise<{ total: number; data: Case[] }> {
    const cursor = this.getCasesCursor(params)
    const total = this.getCasesCount(params)
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
      includeTransactionEvents?: boolean
      includeTransactionUsers?: boolean
    } = {}
  ): Promise<Case | null> {
    const { data } = await this.getCases({
      filterId: `^${caseId}$`,
      includeTransactionEvents: params.includeTransactionEvents ?? false,
      includeTransactionUsers: params.includeTransactionUsers ?? false,
      limit: 1,
      skip: 0,
    })
    if (data.length === 0) {
      return null
    }
    return data[0]
  }

  public async getCaseTransactions(
    caseId: string,
    params: {
      limit: number
      skip: number
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

    return await transactionsRepo.getTransactions({
      filterIdList: caseTransactionsIds,
      afterTimestamp: 0,
      beforeTimestamp: Number.MAX_SAFE_INTEGER,
      limit: params.limit,
      skip: params.skip,
      includeUsers: params.includeUsers,
    })
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
    direction: 'ORIGIN' | 'DESTINATION',
    caseType: CaseType
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection
      .find({
        caseType,
        ...(direction === 'ORIGIN'
          ? {
              'caseUsers.origin.userId': userId,
            }
          : {
              'caseUsers.destination.userId': userId,
            }),
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
}
