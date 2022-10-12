import { v4 as uuidv4 } from 'uuid'
import {
  AggregationCursor,
  Document,
  Filter,
  MongoClient,
  UpdateResult,
} from 'mongodb'
import _ from 'lodash'
import {
  CASES_COLLECTION,
  COUNTER_COLLECTION,
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

  public getCasesMongoQuery(
    params: DefaultApiGetCaseListRequest
  ): Filter<Case> {
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
          $eq: params.filterTransactionState,
        },
      })
    }
    if (params.filterStatus != null) {
      conditions.push({
        'caseTransactions.status': { $eq: params.filterStatus },
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
    return { $and: conditions }
  }

  public async getCasesCursor(
    params: DefaultApiGetCaseListRequest
  ): Promise<AggregationCursor<Case>> {
    const query = this.getCasesMongoQuery(params)
    return this.getDenormalizedCases(query, params)
  }

  private getDenormalizedCases(
    query: Filter<Case>,
    params: DefaultApiGetCaseListRequest
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const sortField =
      params?.sortField !== undefined ? params?.sortField : 'timestamp'
    const sortOrder = params?.sortOrder === 'ascend' ? 1 : -1

    const pipeline: Document[] = [
      { $match: query },
      { $sort: { [sortField]: sortOrder } },
    ]
    if (params?.skip) {
      pipeline.push({ $skip: params.skip })
    }
    if (params?.limit) {
      pipeline.push({ $limit: params.limit })
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
    return collection.aggregate<Case>(pipeline)
  }

  public async getCasesCount(
    params: DefaultApiGetCaseListRequest
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const query = this.getCasesMongoQuery(params)
    return collection.countDocuments(query)
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest
  ): Promise<{ total: number; data: Case[] }> {
    const cursor = await this.getCasesCursor(params)
    const total = await this.getCasesCount(params)
    return { total, data: await cursor.toArray() }
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
        'caseTransactions.transactionId': { $in: transactionIds },
      })
      .toArray()
  }
}
