import { Document, Filter, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import { NotFound } from 'http-errors'
import { compact } from 'lodash'
import { CaseRepository } from './case-repository'
import { MongoDbTransactionRepository } from './mongodb-transaction-repository'
import {
  lookupPipelineStage,
  paginatePipeline,
  prefixRegexMatchFilter,
} from '@/utils/mongodb-utils'
import {
  ACCOUNTS_COLLECTION,
  CASES_COLLECTION,
} from '@/utils/mongodb-definitions'
import {
  COUNT_QUERY_LIMIT,
  CursorPaginationResponse,
  OptionalPagination,
} from '@/utils/pagination'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetAlertTransactionListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Case } from '@/@types/openapi-internal/Case'
import { AlertListResponseItem } from '@/@types/openapi-internal/AlertListResponseItem'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Comment } from '@/@types/openapi-internal/Comment'
import { hasFeature } from '@/core/utils/context'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { isStatusInReview } from '@/utils/helpers'
import { traceable } from '@/core/xray'

export const FLAGRIGHT_SYSTEM_USER = 'Flagright System'

@traceable
export class AlertsRepository {
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb?: DynamoDBDocumentClient }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.tenantId = tenantId
  }

  public async getAlerts(
    params: OptionalPagination<DefaultApiGetAlertListRequest>
  ): Promise<AlertListResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const pipeline = await this.getAlertsPipeline(params, false)

    const itemsPipeline = [...pipeline]
    itemsPipeline.push(...paginatePipeline(params))
    const cursor = collection.aggregate<AlertListResponseItem>(itemsPipeline)
    const itemsPromise = cursor.toArray()
    const countPipelineResp = await this.getAlertsPipeline(params, true)
    const countPipeline = [...countPipelineResp]
    countPipeline.push({
      $limit: COUNT_QUERY_LIMIT,
    })
    countPipeline.push({
      $count: 'count',
    })
    const countPromise = collection
      .aggregate<{ count: number }>(countPipeline)
      .next()
      .then((item) => item?.count ?? 0)

    return {
      total: await countPromise,
      data: await itemsPromise,
    }
  }

  private async getAlertsPipeline(
    params: OptionalPagination<DefaultApiGetAlertListRequest>,
    countOnly = true
  ): Promise<Document[]> {
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const caseConditions: Filter<Case>[] =
      await caseRepository.getCasesConditions(params, false, false)

    const pipeline: Document[] = [
      ...(caseConditions.length > 0
        ? [{ $match: { $and: caseConditions } }]
        : []),
    ]

    if (
      params.filterCaseAfterCreatedTimestamp != null &&
      params.filterCaseBeforeCreatedTimestamp != null
    ) {
      pipeline.push({
        $match: {
          createdTimestamp: {
            $lte: params.filterCaseBeforeCreatedTimestamp,
            $gte: params.filterCaseAfterCreatedTimestamp,
          },
        },
      })
    }

    pipeline.push({
      $unwind: {
        path: '$alerts',
      },
    })

    const conditions: Filter<AlertListResponseItem>[] = []

    if (params.filterCaseId != null) {
      conditions.push({
        'alerts.caseId': params.filterCaseId,
      })
    }
    if (params.filterAction != null) {
      conditions.push({
        'alerts.ruleAction': params.filterAction,
      })
    }

    if (params.filterRulesHit?.length) {
      conditions.push({
        'alerts.ruleInstanceId': {
          $in: params.filterRulesHit,
        },
      })
    }

    if (params.filterQaStatus) {
      conditions.push({
        'alerts.ruleQaStatus': params.filterQaStatus,
      })
    }
    if (params.filterOutQaStatus) {
      conditions.push({
        'alerts.ruleQaStatus': { $nin: params.filterOutQaStatus },
      })
    }

    if (
      params.filterAlertBeforeCreatedTimestamp != null &&
      params.filterAlertAfterCreatedTimestamp != null
    ) {
      conditions.push({
        'alerts.createdTimestamp': {
          $lte: params.filterAlertBeforeCreatedTimestamp,
          $gte: params.filterAlertAfterCreatedTimestamp,
        },
      })
    }

    if (
      params.afterAlertLastUpdatedTimestamp != null &&
      params.beforeAlertLastUpdatedTimestamp != null
    ) {
      conditions.push({
        'alerts.updatedAt': {
          $lte: params.beforeAlertLastUpdatedTimestamp,
          $gte: params.afterAlertLastUpdatedTimestamp,
        },
      })
    }

    if (params.filterOriginPaymentMethods) {
      conditions.push({
        'alerts.originPaymentMethods': {
          $in: params.filterOriginPaymentMethods,
        },
      })
    }
    if (params.filterDestinationPaymentMethods) {
      conditions.push({
        'alerts.destinationPaymentMethods': {
          $in: params.filterDestinationPaymentMethods,
        },
      })
    }

    if (params.filterAlertId != null) {
      conditions.push({
        'alerts.alertId': prefixRegexMatchFilter(params.filterAlertId),
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

    if (params.filterQaAssignmentsIds?.length) {
      conditions.push({
        'alerts.qaAssignment': {
          $elemMatch: {
            assigneeUserId: { $in: params.filterQaAssignmentsIds },
          },
        },
      })
    }

    if (
      params.filterAssignmentsIds != null &&
      params.filterAssignmentsIds?.length
    ) {
      if (
        params.filterAlertStatus?.includes('ESCALATED') ||
        params.filterAlertStatus?.some((status) => isStatusInReview(status))
      ) {
        conditions.push({
          'alerts.reviewAssignments': {
            $elemMatch: {
              assigneeUserId: { $in: params.filterAssignmentsIds },
            },
          },
        })
      } else {
        conditions.push({
          'alerts.assignments': {
            $elemMatch: {
              assigneeUserId: { $in: params.filterAssignmentsIds },
            },
          },
        })
      }
    }
    if (params.filterRuleInstanceId != null) {
      conditions.push({
        'alerts.ruleInstanceId': { $in: params.filterRuleInstanceId },
      })
    }

    if (params.filterOutAlertStatus && params.filterOutAlertStatus.length > 0) {
      conditions.push({
        'alerts.alertStatus': { $nin: params.filterOutAlertStatus },
      })
    }

    if (params.filterAlertStatus && params.filterAlertStatus.length > 0) {
      conditions.push({
        'alerts.alertStatus': { $in: params.filterAlertStatus },
      })
    }

    conditions.push({
      $or: [
        {
          // Need to compare to null, because mongo sometimes replaces undefined with null when saves objects
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          'alerts.availableAfterTimestamp': { $eq: null },
        },
        {
          'alerts.availableAfterTimestamp': { $lt: Date.now() },
        },
      ],
    })

    if (conditions.length > 0) {
      pipeline.push({
        $match: {
          $and: conditions,
        },
      })
    }

    if (!countOnly) {
      pipeline.push(
        ...[
          lookupPipelineStage({
            from: ACCOUNTS_COLLECTION(this.tenantId),
            localField: 'alerts.assignments.assigneeUserId',
            foreignField: 'id',
            as: '_assignee',
          }),
          {
            $set: {
              'alerts._assigneeName': {
                $toLower: { $first: '$_assignee.name' },
              },
            },
          },
          {
            $sort: {
              [params?.sortField === 'caseCreatedTimestamp'
                ? 'createdTimestamp'
                : `alerts.${params?.sortField ?? '_id'}`]:
                params?.sortOrder === 'ascend' ? 1 : -1,
              [`alerts._id`]: 1,
            },
          },
          {
            $set: {
              alert: '$alerts',
              caseCreatedTimestamp: '$createdTimestamp',
            },
          },
        ]
      )

      pipeline.push({
        $project: {
          alert: 1,
          caseCreatedTimestamp: 1,
          'caseUsers.origin.userId': 1,
          'caseUsers.destination.userId': 1,
          'caseUsers.origin.userDetails.name': 1,
          'caseUsers.destination.userDetails.name': 1,
          'caseUsers.origin.legalEntity.companyGeneralDetails.legalName': 1,
          'caseUsers.destination.legalEntity.companyGeneralDetails.legalName': 1,
          'caseUsers.origin.type': 1,
          'caseUsers.destination.type': 1,
        },
      })
    }
    return pipeline
  }

  public async getAlertById(alertId: string): Promise<Alert | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const result = await collection.findOne({
      'alerts.alertId': alertId,
    })

    if (!result) {
      return null
    }

    return result.alerts?.find((alert) => alert.alertId === alertId) ?? null
  }

  public async getAlertsByIds(alertIds: string[]): Promise<Alert[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const result = await collection
      .find({ 'alerts.alertId': { $in: alertIds } })
      .project({ alerts: 1 })
      .toArray()

    return result
      .flatMap((caseItem) => caseItem.alerts ?? [])
      .filter((alert) => alertIds.includes(alert.alertId))
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
      {
        caseId,
      },
      {
        $push: {
          'alerts.$[alert].comments': commentToSave,
        },
        $set: {
          updatedAt: now,
          'alerts.$[alert].updatedAt': now,
        },
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

  public async saveAlert(caseId: string, alert: Alert): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const now = Date.now()
    alert.updatedAt = now

    await collection.findOneAndUpdate(
      {
        caseId,
      },
      {
        $set: {
          'alerts.$[alert]': alert,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': alert.alertId,
          },
        ],
      }
    )
  }

  public async saveAlertsComment(
    alertIds: string[],
    caseIds: string[],
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

    await collection.updateMany(
      {
        caseId: {
          $in: caseIds,
        },
      },
      {
        $push: {
          'alerts.$[alert].comments': commentToSave,
        },
        $set: {
          updatedAt: now,
          'alerts.$[alert].updatedAt': now,
        },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': {
              $in: alertIds,
            },
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

    const now = Date.now()

    await collection.updateOne(
      {
        caseId,
      },
      {
        $pull: {
          'alerts.$[alert].comments': {
            id: commentId,
          },
        },
        $set: {
          updatedAt: now,
          'alerts.$[alert].updatedAt': now,
        },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': alertId,
          },
        ],
      }
    )
  }

  public async updateAlertsStatus(
    alertIds: string[],
    caseIds: string[],
    statusChange: CaseStatusChange,
    isLastInReview?: boolean
  ): Promise<{
    caseIdsWithAllAlertsSameStatus: string[]
    caseStatusToChange?: CaseStatus
  }> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const now = Date.now()

    const statusChangePipline = {
      ...statusChange,
      userId: isLastInReview
        ? '$$alert.lastStatusChange.userId'
        : statusChange.userId,
      reviewerId: isLastInReview ? statusChange.userId : undefined,
    }

    await collection.updateMany(
      {
        caseId: {
          $in: caseIds,
        },
        'alerts.alertId': {
          $in: alertIds,
        },
      },
      [
        {
          $set: {
            alerts: {
              $map: {
                input: '$alerts',
                as: 'alert',
                in: {
                  $cond: {
                    if: {
                      $in: ['$$alert.alertId', alertIds],
                    },
                    then: {
                      $mergeObjects: [
                        '$$alert',
                        {
                          alertStatus: statusChange.caseStatus,
                          lastStatusChange: statusChangePipline,
                          updatedAt: now,
                          statusChanges: {
                            $concatArrays: [
                              { $ifNull: ['$$alert.statusChanges', []] },
                              [statusChangePipline],
                            ],
                          },
                        },
                      ],
                    },
                    else: '$$alert',
                  },
                },
              },
            },
            updatedAt: now,
          },
        },
      ]
    )

    const caseItems = await collection
      .find({
        caseId: { $in: caseIds },
      })
      .toArray()

    const caseStatusToCheck = ['ESCALATED', 'CLOSED'].includes(
      statusChange?.caseStatus ?? ''
    )
      ? statusChange?.caseStatus
      : statusChange?.caseStatus === 'IN_REVIEW_CLOSED'
      ? 'IN_REVIEW_CLOSED'
      : undefined

    const caseIdsWithAllAlertsSameStatus = caseStatusToCheck
      ? caseItems
          .filter((caseItem) =>
            caseItem.alerts?.every((alert) => {
              return alert.alertStatus === caseStatusToCheck
            })
          )
          .map((caseItem) => caseItem.caseId)
      : []

    return {
      caseIdsWithAllAlertsSameStatus: compact(caseIdsWithAllAlertsSameStatus),
      caseStatusToChange: caseStatusToCheck,
    }
  }

  public async getAlertTransactionsHit(
    params: OptionalPagination<DefaultApiGetAlertTransactionListRequest>
  ): Promise<CursorPaginationResponse<InternalTransaction>> {
    const alert = await this.getAlertById(params.alertId)

    if (alert == null) {
      throw new NotFound(`Alert "${params.alertId}" not found`)
    }

    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const result = await transactionsRepo.getTransactionsCursorPaginate({
      filterIdList: alert.transactionIds,
      afterTimestamp: params.afterTimestamp || 0,
      beforeTimestamp: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
      page: params.page,
      pageSize: params.pageSize,
      filterOriginUserId: params.originUserId,
      filterDestinationUserId: params.destinationUserId,
      filterUserId: params.userId,
      start: params.start,
      sortOrder: params.sortOrder,
      sortField: params.sortField,
      filterOriginPaymentMethodId: params.filterOriginPaymentMethodId,
      filterDestinationPaymentMethodId: params.filterDestinationPaymentMethodId,
      filterId: params.filterTransactionId,
      transactionType: params.filterTransactionType,
      filterOriginCurrencies: params.filterOriginCurrencies,
      filterDestinationCurrencies: params.filterDestinationCurrencies,
      filterOriginPaymentMethods: params.filterOriginPaymentMethods,
      filterDestinationPaymentMethods: params.filterDestinationPaymentMethods,
    })

    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    if (hasFeature('PULSE')) {
      result.items = await riskRepository.augmentRiskLevel(result.items)
    }

    return result
  }

  public async updateAlertsReviewAssignments(
    alertIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    return this.updateReviewAssigneeToAlertsPrivate(alertIds, reviewAssignments)
  }

  public async updateAlertsAssignments(
    alertIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    return this.updateAssigneeToAlertsPrivate(alertIds, assignments)
  }

  private async updateReviewAssigneeToAlertsPrivate(
    alertIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const now = Date.now()

    await collection.updateMany(
      {
        'alerts.alertId': {
          $in: alertIds,
        },
      },
      {
        $set: {
          'alerts.$[alert].reviewAssignments': reviewAssignments,
          'alerts.$[alert].updatedAt': now,
        },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': {
              $in: alertIds,
            },
          },
        ],
      }
    )
  }

  public async updateInReviewAssignemnts(
    alertIds: string[],
    assignments: Assignment[],
    reviewAssignments: Assignment[]
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    await collection.updateMany(
      {
        'alerts.alertId': {
          $in: alertIds,
        },
      },
      {
        $set: {
          'alerts.$[alert].assignments': assignments,
          'alerts.$[alert].reviewAssignments': reviewAssignments,
        },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': {
              $in: alertIds,
            },
          },
        ],
      }
    )
  }

  private async updateAssigneeToAlertsPrivate(
    alertIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const now = Date.now()

    await collection.updateMany(
      {
        'alerts.alertId': {
          $in: alertIds,
        },
      },
      {
        $set: {
          'alerts.$[alert].assignments': assignments,
          'alerts.$[alert].updatedAt': now,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': {
              $in: alertIds,
            },
          },
        ],
      }
    )
  }
}
