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
  ACCOUNTS_COLLECTION,
  CASES_COLLECTION,
  COUNTER_COLLECTION,
  paginatePipeline,
  prefixRegexMatchFilter,
  TRANSACTION_EVENTS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetCaseListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { EntityCounter } from '@/@types/openapi-internal/EntityCounter'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Priority } from '@/@types/openapi-internal/Priority'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { Tag } from '@/@types/openapi-public/Tag'
import { TransactionsListResponse } from '@/@types/openapi-internal/TransactionsListResponse'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { RulesHitPerCase } from '@/@types/openapi-internal/RulesHitPerCase'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import {
  getRiskLevelFromScore,
  getRiskScoreBoundsFromLevel,
} from '@/services/risk-scoring/utils'
import { hasFeature, hasFeatures } from '@/core/utils/context'
import {
  COUNT_QUERY_LIMIT,
  OptionalPagination,
  OptionalPaginationParams,
  PaginationParams,
} from '@/utils/pagination'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { AlertListResponseItem } from '@/@types/openapi-internal/AlertListResponseItem'
import { CaseResponse } from '@/@types/openapi-internal/CaseResponse'

export const MAX_TRANSACTION_IN_A_CASE = 1000

export type CaseListOptions = {
  includeCaseTransactionIds?: boolean
}

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

  static getPriority(ruleCasePriority: ReadonlyArray<Priority>): Priority {
    return ruleCasePriority.reduce((prev, curr) => {
      if (PRIORITYS.indexOf(curr) < PRIORITYS.indexOf(prev)) {
        return curr
      } else {
        return prev
      }
    }, PRIORITYS[PRIORITYS.length - 1])
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
        if (caseEntity.alerts) {
          caseEntity.alerts = await Promise.all(
            caseEntity.alerts?.map(async (alert) => {
              if (alert._id && alert.alertId) {
                return {
                  ...alert,
                  caseId: caseEntity.caseId,
                }
              }
              const counterCollection = db.collection<EntityCounter>(
                COUNTER_COLLECTION(this.tenantId)
              )
              const alertCount = (
                await counterCollection.findOneAndUpdate(
                  { entity: 'Alert' },
                  { $inc: { count: 1 } },
                  { upsert: true, returnDocument: 'after' }
                )
              ).value

              return {
                ...alert,
                _id: alert._id ?? alertCount?.count,
                alertId: alert.alertId ?? `A-${alertCount?.count}`,
                caseId: caseEntity.caseId,
              }
            })
          )
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

  private async getCasesConditions(
    params: OptionalPagination<DefaultApiGetCaseListRequest>
  ): Promise<Filter<Case>[]> {
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

    if (
      params.beforeCaseLastUpdatedTimestamp != null &&
      params.afterCaseLastUpdatedTimestamp != null
    ) {
      conditions.push({
        'lastStatusChange.timestamp': {
          $lte: params.beforeCaseLastUpdatedTimestamp,
          $gte: params.afterCaseLastUpdatedTimestamp,
        },
      })
    }

    if (params.filterId != null) {
      conditions.push({ caseId: prefixRegexMatchFilter(params.filterId) })
    }
    if (params.filterIdExact != null) {
      conditions.push({ caseId: params.filterIdExact })
    }
    if (params.transactionType != null) {
      conditions.push({
        'caseTransactions.type': prefixRegexMatchFilter(params.transactionType),
      })
    }
    if (params.filterOutStatus != null) {
      conditions.push({
        'caseTransactions.status': { $nin: [params.filterOutStatus] },
      })
    }
    if (params.filterOutCaseStatus != null) {
      conditions.push({
        caseStatus: { $nin: [params.filterOutCaseStatus] },
      })
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
      conditions.push({ caseStatus: { $in: [params.filterCaseStatus] } })
    }
    if (params.filterUserId != null) {
      conditions.push({
        $or: [
          { 'caseUsers.origin.userId': { $in: [params.filterUserId] } },
          { 'caseUsers.destination.userId': { $in: [params.filterUserId] } },
        ],
      })
    } else {
      if (params.filterOriginUserId != null) {
        conditions.push({
          'caseUsers.origin.userId': { $in: [params.filterOriginUserId] },
        })
      }
      if (params.filterDestinationUserId != null) {
        conditions.push({
          'caseUsers.destination.userId': {
            $in: [params.filterDestinationUserId],
          },
        })
      }
    }

    if (params.filterTransactionId != null) {
      conditions.push({
        'caseTransactions.transactionId': { $in: [params.filterTransactionId] },
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
          $in: [params.filterOriginPaymentMethod],
        },
      })
    }
    if (params.filterDestinationPaymentMethod != null) {
      conditions.push({
        'caseTransactions.destinationPaymentDetails.method': {
          $in: [params.filterDestinationPaymentMethod],
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
          $in: [params.filterOriginCountry],
        },
      })
    }

    if (params.filterDestinationCountry != null) {
      conditions.push({
        'caseTransactions.destinationAmountDetails.country': {
          $in: [params.filterDestinationCountry],
        },
      })
    }

    if (params.filterPriority != null) {
      conditions.push({
        priority: {
          $in: [params.filterPriority],
        },
      })
    }
    if (params.filterTransactionTagKey || params.filterTransactionTagValue) {
      const elemCondition: { [attr: string]: Filter<Tag> } = {}
      if (params.filterTransactionTagKey) {
        elemCondition['key'] = { $in: [params.filterTransactionTagKey] }
      }
      if (params.filterTransactionTagValue) {
        elemCondition['value'] = prefixRegexMatchFilter(
          params.filterTransactionTagValue
        )
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

    return conditions
  }

  public async getCasesMongoPipeline(
    params: OptionalPagination<DefaultApiGetCaseListRequest>,
    options: CaseListOptions = {}
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

    const conditions = await this.getCasesConditions(params)

    if (
      params.filterAssignmentsIds != null &&
      params.filterAssignmentsIds.length > 0
    ) {
      conditions.push({
        assignments: {
          $elemMatch: {
            assigneeUserId: { $in: params.filterAssignmentsIds },
          },
        },
      })
    }
    const filter = { $and: conditions }

    const preLimitPipeline: Document[] = []
    const postLimitPipeline: Document[] = []

    preLimitPipeline.push({ $match: filter })

    const sortUserCaseUserName = params.sortField === '_userName'
    const sortAssignments = params.sortField === '_assignmentsName'

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
    } else if (sortAssignments) {
      preLimitPipeline.push(
        ...[
          {
            $lookup: {
              from: ACCOUNTS_COLLECTION(this.tenantId),
              localField: 'assignments.assigneeUserId',
              foreignField: 'id',
              as: '_assignments',
            },
          },
          {
            $set: {
              _assignmentName: { $toLower: { $first: '$_assignments.name' } },
              _assignments: false,
            },
          },
        ]
      )
    }

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

    preLimitPipeline.push({ $sort: { [sortField]: sortOrder, _id: 1 } })
    // project should always be the last stage
    postLimitPipeline.push({
      $project: {
        _id: 1,
        assignments: 1,
        caseId: 1,
        caseStatus: 1,
        createdTimestamp: 1,
        priority: 1,
        caseUsers: 1,
        caseTransactionsCount: '$_transactionsHit',
        lastStatusChange: 1,
        comments: 1,
        falsePositiveDetails: 1,
        alerts: 1,
        ...(options.includeCaseTransactionIds
          ? { caseTransactionsIds: 1 }
          : {}),
      },
    })
    return { preLimitPipeline, postLimitPipeline }
  }

  public async getCasesCursor(
    params: OptionalPagination<DefaultApiGetCaseListRequest>,
    options: CaseListOptions = {}
  ): Promise<AggregationCursor<Case>> {
    const { preLimitPipeline, postLimitPipeline } =
      await this.getCasesMongoPipeline(params, options)
    postLimitPipeline.push(...paginatePipeline(params))
    return this.getDenormalizedCases(preLimitPipeline.concat(postLimitPipeline))
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
    const conditions = await this.getCasesConditions(params)
    const count = await collection.countDocuments(
      { $and: conditions },
      { limit: COUNT_QUERY_LIMIT }
    )
    return count
  }

  public async getAlerts(
    params: OptionalPagination<DefaultApiGetAlertListRequest>
  ): Promise<AlertListResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const pipeline = await this.getAlertsPipeline(params)

    const itemsPipeline = [...pipeline]
    itemsPipeline.push(...paginatePipeline(params))
    const cursor = collection.aggregate<AlertListResponseItem>(itemsPipeline, {
      allowDiskUse: true,
    })
    const itemsPromise = cursor.toArray()

    const countPipeline = [...pipeline]
    countPipeline.push({
      $limit: COUNT_QUERY_LIMIT,
    })
    countPipeline.push({
      $count: 'count',
    })
    const countPromise = collection
      .aggregate<{ count: number }>(countPipeline, { allowDiskUse: true })
      .next()
      .then((item) => item?.count ?? 0)

    return {
      total: await countPromise,
      data: await itemsPromise,
    }
  }

  private async getAlertsPipeline(
    params: OptionalPagination<DefaultApiGetAlertListRequest>
  ): Promise<Document[]> {
    const caseConditions: Filter<Case>[] = await this.getCasesConditions(params)

    const pipeline: Document[] = [
      ...(caseConditions.length > 0
        ? [{ $match: { $and: caseConditions } }]
        : []),
      {
        $unwind: {
          path: '$alerts',
        },
      },
      {
        $project: {
          alert: '$alerts',
          caseCreatedTimestamp: '$createdTimestamp',
          caseUsers: '$caseUsers',
        },
      },
      {
        $lookup: {
          from: ACCOUNTS_COLLECTION(this.tenantId),
          localField: 'alert.assignments.assigneeUserId',
          foreignField: 'id',
          as: '_assignee',
        },
      },
      {
        $set: {
          'alert._assigneeName': { $toLower: { $first: '$_assignee.name' } },
        },
      },
      {
        $sort: {
          [`alert.${params.sortField ?? '_id'}`]:
            params?.sortOrder === 'ascend' ? 1 : -1,
          [`alert._id`]: 1,
        },
      },
    ]

    const conditions: Filter<AlertListResponseItem>[] = []

    if (params.filterCaseId != null) {
      conditions.push({
        'alert.caseId': params.filterCaseId,
      })
    }

    if (
      params.afterAlertLastUpdatedTimestamp != null &&
      params.beforeAlertLastUpdatedTimestamp != null
    ) {
      conditions.push({
        'alert.lastStatusChange.timestamp': {
          $lte: params.beforeAlertLastUpdatedTimestamp,
          $gte: params.afterAlertLastUpdatedTimestamp,
        },
      })
    }

    if (params.filterAlertId != null) {
      conditions.push({
        'alert.alertId': prefixRegexMatchFilter(params.filterAlertId),
      })
    }
    if (params.filterOutCaseStatus != null) {
      conditions.push({
        caseStatus: { $not: { $in: [params.filterOutCaseStatus] } },
      })
    }
    if (params.filterCaseStatus != null) {
      conditions.push({
        caseStatus: { $in: [params.filterCaseStatus] },
      })
    }
    if (params.filterOutAlertStatus != null) {
      conditions.push({
        'alert.alertStatus': { $nin: [params.filterOutAlertStatus] },
      })
    }
    if (params.filterAlertStatus != null) {
      conditions.push({
        'alert.alertStatus': { $in: [params.filterAlertStatus] },
      })
    }
    if (
      params.filterAssignmentsIds != null &&
      params.filterAssignmentsIds?.length
    ) {
      conditions.push({
        'alert.assignments': {
          $elemMatch: {
            assigneeUserId: { $in: params.filterAssignmentsIds },
          },
        },
      })
    }

    if (conditions.length > 0) {
      pipeline.push({
        $match: {
          $and: conditions,
        },
      })
    }

    pipeline.push({
      $project: {
        _assignee: 0,
        'alert._assigneeName': 0,
      },
    })

    return pipeline
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest,
    options: CaseListOptions = {}
  ): Promise<{ total: number; data: CaseResponse[] }> {
    let cursor = await this.getCasesCursor(params, options)
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
    }
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const isCaseStatusClosed = updates.statusChange?.caseStatus === 'CLOSED'

    await collection.updateMany(
      { caseId: { $in: caseIds } },
      {
        $set: _.omitBy<Partial<Case>>(
          {
            assignments: updates.assignments,
            caseStatus: updates.statusChange?.caseStatus,
            lastStatusChange: updates.statusChange,
            ...(isCaseStatusClosed
              ? {
                  'alerts.$[].alertStatus': updates.statusChange?.caseStatus,
                  'alerts.$[].lastStatusChange': updates.statusChange,
                }
              : {}),
          },
          _.isNil
        ),
        ...(updates.statusChange
          ? {
              $push: {
                statusChanges: updates.statusChange,
                ...(isCaseStatusClosed
                  ? { 'alerts.$[].statusChanges': updates.statusChange }
                  : {}),
              },
            }
          : {}),
      }
    )
  }

  public async updateAlerts(
    alertIds: string[],
    updates: {
      assignments?: Assignment[]
      statusChange?: CaseStatusChange
    }
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const result: Promise<unknown>[] = []
    const casesCursor = collection.find({
      'alerts.alertId': { $in: alertIds },
    })
    while (await casesCursor.hasNext()) {
      const caseItem = await casesCursor.next()
      if (caseItem == null) {
        break
      }
      const newAlerts = caseItem.alerts?.map((alert) => {
        if (!alertIds.includes(alert.alertId as string)) {
          return alert
        }
        const newAlert: Alert = {
          ...alert,
        }
        if (updates.assignments) {
          newAlert.assignments = updates.assignments
        }
        if (updates.statusChange) {
          newAlert.alertStatus = updates.statusChange.caseStatus
          newAlert.lastStatusChange = updates.statusChange
          newAlert.statusChanges = (newAlert.statusChanges ?? []).concat(
            updates.statusChange
          )
        }

        return newAlert
      })

      const isAllAlertsClosed = newAlerts?.every(
        (alert) => alert.alertStatus === 'CLOSED'
      )

      if (caseItem.caseId != null && newAlerts) {
        result.push(
          collection.updateOne(
            {
              caseId: caseItem.caseId,
            },
            {
              $set: {
                alerts: newAlerts,
                ...(isAllAlertsClosed
                  ? {
                      caseStatus: 'CLOSED',
                      lastStatusChange: updates.statusChange,
                    }
                  : {}),
              },
              ...(isAllAlertsClosed
                ? {
                    $push: {
                      statusChanges: updates.statusChange,
                    },
                  }
                : {}),
            }
          )
        )
      }
    }
    await Promise.all(result)
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

  public async saveAlertComment(
    caseId: string,
    alertId: string,
    comment: Comment
  ): Promise<Comment> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const now = Date.now()
    const commentToSave: Comment = {
      ...comment,
      id: comment.id || uuidv4(),
      createdAt: comment.createdAt ?? now,
      updatedAt: now,
    }
    await collection.findOneAndUpdate(
      { caseId },
      {
        $push: { 'alerts.$[alert].comments': commentToSave },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': alertId,
          },
        ],
      }
    )
    return commentToSave
  }

  public async deleteAlertComment(
    caseId: string,
    alertId: string,
    commentId: string
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    // todo: check if alert and comment exists
    const caseItem = await collection.findOne({
      caseId: caseId,
    })
    if (caseItem == null) {
      throw new Error(`Unable to find case "${caseId}"`)
    }
    await collection.replaceOne(
      {
        caseId,
      },
      {
        ...caseItem,
        alerts: caseItem.alerts?.map((alert) => {
          if (alert.alertId !== alertId) {
            return alert
          }
          return {
            ...alert,
            comments: alert.comments?.filter(({ id }) => id !== commentId),
          }
        }),
      }
    )
  }

  public async deleteCaseComment(caseId: string, commentId: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    await collection.updateOne(
      { caseId },
      { $pull: { comments: { id: commentId } } }
    )
  }

  public async getCaseById(
    caseId: string,
    options: CaseListOptions = {}
  ): Promise<CaseResponse | null> {
    const { data } = await this.getCases(
      {
        filterIdExact: caseId,
        page: 1,
        pageSize: 1,
      },
      options
    )
    return data?.find((c) => c.caseId === caseId) ?? null
  }

  public async getAlertById(alertId: string): Promise<Alert | null> {
    const { data } = await this.getAlerts({
      filterAlertId: alertId,
      page: 1,
      pageSize: 1,
    })
    return data?.find((c) => c.alert.alertId === alertId)?.alert ?? null
  }

  public async getCaseTransactions(
    caseId: string,
    params: OptionalPaginationParams & {
      includeUsers?: boolean
    }
  ): Promise<TransactionsListResponse> {
    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const caseItem = await this.getCaseById(caseId, {
      includeCaseTransactionIds: true,
    })
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

  public async getAlertTransactions(
    alertId: string,
    params: OptionalPaginationParams
  ): Promise<TransactionsListResponse> {
    const alert = await this.getAlertById(alertId)
    if (alert == null) {
      throw new NotFound(`Alert "${alertId}" not found `)
    }

    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    return await transactionsRepo.getTransactions({
      filterIdList: alert.transactionIds,
      afterTimestamp: 0,
      beforeTimestamp: Number.MAX_SAFE_INTEGER,
      page: params.page,
      pageSize: params.pageSize,
    })
  }

  private getCaseRulesMongoPipeline(caseFilter: string) {
    return [
      {
        $match: {
          caseId: prefixRegexMatchFilter(caseFilter),
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
    const cursor = this.getCaseRulesCursor(caseId)
    return await cursor.toArray()
  }

  private getCaseRuleTransactionsMongoPipeline(
    caseId: string,
    ruleInstanceId: string
  ) {
    return [
      {
        $match: {
          caseId,
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
          'caseTransactions.hitRules.ruleInstanceId': ruleInstanceId,
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
    caseId: string,
    ruleInstanceId: string,
    params: PaginationParams,
    sortFields: { sortField: string; sortOrder: string }
  ) {
    const pipeline = this.getCaseRuleTransactionsMongoPipeline(
      caseId,
      ruleInstanceId
    )

    const sortOrder = sortFields.sortOrder === 'ascend' ? 1 : -1

    const db = this.mongoDb.db()
    const collection = db.collection<InternalTransaction>(
      CASES_COLLECTION(this.tenantId)
    )
    return collection.aggregate<InternalTransaction>(
      [
        ...pipeline,
        {
          $sort: {
            [sortFields.sortField ?? 'caseTransactions.timestamp']:
              sortOrder ?? -1,
          },
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
    params: PaginationParams,
    sortFields: { sortField: string; sortOrder: string }
  ): Promise<{ total: number; cases: InternalTransaction[] }> {
    const cursor = this.getCaseRuleTransactionsCursor(
      caseId,
      ruleInstanceId,
      params,
      sortFields
    )

    const res = await cursor.toArray()

    if (hasFeatures(['PULSE'])) {
      const riskRepository = new RiskRepository(this.tenantId, {
        dynamoDb: this.dynamoDb,
      })

      const riskClassificationValues =
        await riskRepository.getRiskClassificationValues()

      for (const caseItem of res) {
        if (caseItem?.arsScore?.arsScore) {
          caseItem.arsScore.riskLevel = getRiskLevelFromScore(
            riskClassificationValues,
            caseItem.arsScore.arsScore
          )
        }
      }
    }

    return {
      total: await this.getCaseRuleTransactionsCount(caseId, ruleInstanceId),
      cases: res,
    }
  }

  public async getCasesByTransactionId(
    transactionId: string
  ): Promise<CaseResponse[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection
      .find({
        'caseTransactions.transactionId': transactionId,
      })
      .toArray()
  }

  public async getCasesByUserId(
    userId: string,
    params: {
      directions?: ('ORIGIN' | 'DESTINATION')[]
      filterMaxTransactions?: number
      filterOutCaseStatus?: CaseStatus
    }
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const filters: Filter<Case>[] = []

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
    transactionIds: string[]
  ): Promise<CaseResponse[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection
      .find({
        caseTransactionsIds: { $in: transactionIds },
      })
      .toArray()
  }

  public async getCasesByIds(caseIds: string[]): Promise<CaseResponse[]> {
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
