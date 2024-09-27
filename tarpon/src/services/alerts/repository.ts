import { Document, Filter, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { NotFound } from 'http-errors'
import { compact, difference, intersection, isEmpty } from 'lodash'
import dayjsLib from '@flagright/lib/utils/dayjs'
import { CaseRepository, getRuleQueueFilter } from '../cases/repository'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import {
  DAY_DATE_FORMAT,
  lookupPipelineStage,
  paginatePipeline,
  prefixRegexMatchFilter,
} from '@/utils/mongodb-utils'
import {
  ACCOUNTS_COLLECTION,
  ALERTS_QA_SAMPLING_COLLECTION,
  CASES_COLLECTION,
} from '@/utils/mongodb-definitions'
import {
  COUNT_QUERY_LIMIT,
  CursorPaginationResponse,
  OptionalPagination,
} from '@/utils/pagination'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetAlertsQaSamplingRequest,
  DefaultApiGetAlertTransactionListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Case } from '@/@types/openapi-internal/Case'
import { AlertListResponseItem } from '@/@types/openapi-internal/AlertListResponseItem'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getContext, hasFeature } from '@/core/utils/context'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { traceable } from '@/core/xray'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { ALERT_STATUSS } from '@/@types/openapi-internal-custom/AlertStatus'
import { shouldUseReviewAssignments } from '@/utils/helpers'
import { Account } from '@/@types/openapi-internal/Account'
import { ChecklistStatus } from '@/@types/openapi-internal/ChecklistStatus'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { AlertsQASampleIds } from '@/@types/openapi-internal/AlertsQASampleIds'
import { CounterRepository } from '@/services/counter/repository'
import { CaseAggregates } from '@/@types/openapi-internal/CaseAggregates'
import { RuleInstanceAlertsStats } from '@/@types/openapi-internal/RuleInstanceAlertsStats'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { AccountsService } from '@/services/accounts'

export const FLAGRIGHT_SYSTEM_USER = 'Flagright System'
export const API_USER = 'API'

export interface AlertParams
  extends OptionalPagination<
    Omit<DefaultApiGetAlertListRequest, 'filterQaStatus'>
  > {
  filterQaStatus?: Array<ChecklistStatus | "NOT_QA'd">
  excludeAlertIds?: string[]
}

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
    params: AlertParams,
    options?: { hideTransactionIds?: boolean }
  ): Promise<AlertListResponse> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const pipeline = await this.getAlertsPipeline(params, {
      hideTransactionIds: options?.hideTransactionIds,
      countOnly: false,
    })
    const countPipelineResp = await this.getAlertsPipeline(params, {
      hideTransactionIds: options?.hideTransactionIds,
      countOnly: true,
    })

    pipeline.push(...paginatePipeline(params))

    const itemsPipeline = [...pipeline]
    const countPipeline = [...countPipelineResp]

    countPipeline.push({
      $limit: COUNT_QUERY_LIMIT,
    })
    countPipeline.push({
      $count: 'count',
    })

    const cursor = collection.aggregate<AlertListResponseItem>(itemsPipeline)
    const itemsPromise = cursor.toArray()
    const countPromise = collection
      .aggregate<{ count: number }>(countPipeline)
      .next()
      .then((item) => item?.count ?? 0)

    return {
      total: await countPromise,
      data: await itemsPromise,
    }
  }

  public updateAISummary(
    alertId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    return collection.updateOne(
      { 'alerts.alertId': alertId },
      {
        $set: {
          'alerts.$[alert].comments.$[comment].files.$[file].aiSummary':
            summary,
          'alerts.$[alert].updatedAt': Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        arrayFilters: [
          { 'alert.alertId': alertId },
          { 'comment.id': commentId },
          { 'file.s3Key': fileS3Key },
        ],
      }
    )
  }

  private getAssignmentFilter = (
    key: 'reviewAssignments' | 'assignments',
    filterAssignmentsIds: string[]
  ): Document[] => {
    const isUnassignedIncluded = filterAssignmentsIds.includes('Unassigned')
    const assignmentsStatus = this.getAssignmentsStatus(key)
    return [
      {
        $and: [
          { ['alerts.alertStatus']: { $in: assignmentsStatus } },
          isUnassignedIncluded
            ? {
                $or: [
                  {
                    [`alerts.${key}.assigneeUserId`]: {
                      $in: filterAssignmentsIds,
                    },
                  },
                  {
                    $or: [
                      { [`alerts.${key}`]: { $size: 0 } },
                      { [`alerts.${key}`]: { $exists: false } },
                    ],
                  },
                ],
              }
            : {
                [`alerts.${key}.assigneeUserId`]: {
                  $in: filterAssignmentsIds,
                },
              },
        ],
      },
    ]
  }

  private getAssignmentsStatus = (
    key: 'reviewAssignments' | 'assignments'
  ): AlertStatus[] => {
    const reviewAssignmentsStatus = ALERT_STATUSS.filter((status) =>
      shouldUseReviewAssignments(status)
    )
    const assignmentsStatus = difference(ALERT_STATUSS, reviewAssignmentsStatus)

    return key === 'assignments' ? assignmentsStatus : reviewAssignmentsStatus
  }

  public async getAlertsPipeline(
    params: AlertParams,
    options?: {
      hideTransactionIds?: boolean
      countOnly?: boolean
      excludeProject?: boolean
    }
  ): Promise<Document[]> {
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

    const caseConditions: Filter<Case>[] =
      await caseRepository.getCasesConditions(params, false)

    if (params.filterOutCaseStatus != null) {
      caseConditions.push({
        caseStatus: { $nin: params.filterOutCaseStatus },
      })
    }
    if (params.filterCaseStatus != null) {
      caseConditions.push({
        caseStatus: { $in: params.filterCaseStatus },
      })
    }

    if (
      params.filterCaseAfterCreatedTimestamp != null &&
      params.filterCaseBeforeCreatedTimestamp != null
    ) {
      caseConditions.push({
        createdTimestamp: {
          $lte: params.filterCaseBeforeCreatedTimestamp,
          $gte: params.filterCaseAfterCreatedTimestamp,
        },
      })
    }

    const pipeline: Document[] = [
      ...(caseConditions.length > 0
        ? [{ $match: { $and: caseConditions } }]
        : []),
    ]

    const alertConditions: Filter<AlertListResponseItem>[] = []

    if (params.excludeAlertIds != null) {
      alertConditions.push({
        'alerts.alertId': { $nin: params.excludeAlertIds },
      })
    }

    if (params.filterTransactionIds != null) {
      alertConditions.push({
        'alerts.transactionIds': { $in: params.filterTransactionIds },
      })
    }

    if (params.filterCaseId != null) {
      alertConditions.push({
        'alerts.caseId': params.filterCaseId,
      })
    }
    if (params.filterAction != null) {
      alertConditions.push({
        'alerts.ruleAction': params.filterAction,
      })
    }

    if (params.filterRulesHit?.length) {
      alertConditions.push({
        'alerts.ruleInstanceId': {
          $in: params.filterRulesHit,
        },
      })
    }

    if (params.filterAlertPriority?.length) {
      alertConditions.push({
        'alerts.priority': {
          $in: params.filterAlertPriority,
        },
      })
    }

    if (params.filterQaStatus) {
      const filterQaStatus = params.filterQaStatus.map((status) =>
        (status as string) === "NOT_QA'd" ? undefined : status
      )
      alertConditions.push({
        'alerts.ruleQaStatus': { $in: filterQaStatus },
      })
    }
    if (params.filterOutQaStatus) {
      alertConditions.push({
        'alerts.ruleQaStatus': { $nin: params.filterOutQaStatus },
      })
    }

    if (
      params.filterAlertBeforeCreatedTimestamp != null &&
      params.filterAlertAfterCreatedTimestamp != null
    ) {
      alertConditions.push({
        'alerts.createdTimestamp': {
          $lte: params.filterAlertBeforeCreatedTimestamp,
          $gte: params.filterAlertAfterCreatedTimestamp,
        },
      })
    }

    if (
      params.filterAlertsByLastUpdatedEndTimestamp != null &&
      params.filterAlertsByLastUpdatedStartTimestamp != null
    ) {
      alertConditions.push({
        'alerts.updatedAt': {
          $gte: params.filterAlertsByLastUpdatedStartTimestamp,
          $lte: params.filterAlertsByLastUpdatedEndTimestamp,
        },
      })
    }

    if (params.filterClosingReason != null) {
      alertConditions.push({
        $and: [
          {
            'alerts.alertStatus': 'CLOSED',
          },
          {
            'alerts.lastStatusChange.reason': {
              $in: params.filterClosingReason,
            },
          },
        ],
      })
    }

    if (params.filterOriginPaymentMethods) {
      alertConditions.push({
        'alerts.originPaymentMethods': {
          $in: params.filterOriginPaymentMethods,
        },
      })
    }
    if (params.filterDestinationPaymentMethods) {
      alertConditions.push({
        'alerts.destinationPaymentMethods': {
          $in: params.filterDestinationPaymentMethods,
        },
      })
    }

    if (params.filterAlertId != null) {
      alertConditions.push({
        'alerts.alertId': prefixRegexMatchFilter(params.filterAlertId),
      })
    }

    if (params.filterAlertIds != null) {
      alertConditions.push({
        'alerts.alertId': { $in: params.filterAlertIds },
      })
    }

    if (params.filterQaAssignmentsIds?.length) {
      alertConditions.push({
        'alerts.qaAssignment': {
          $elemMatch: {
            assigneeUserId: { $in: params.filterQaAssignmentsIds },
          },
        },
      })
    }

    if (
      params.filterAssignmentsRoles &&
      !isEmpty(params.filterAssignmentsRoles)
    ) {
      // Since the number of accounts is typically a small number, we can fetch relevant accounts and filter cases by
      // making use of the `params.filterAssignmentsIds` field.
      const accountsService = await AccountsService.getInstance()
      const accountIdsWithRole = await accountsService.getAccountIdsForRoles(
        this.tenantId,
        params.filterAssignmentsRoles
      )

      if (params.filterAssignmentsRoles.includes('Unassigned')) {
        // Special case to handle unassigned cases
        accountIdsWithRole.push('Unassigned')
      }

      if (isEmpty(params.filterAssignmentsIds)) {
        params.filterAssignmentsIds = accountIdsWithRole
      } else {
        params.filterAssignmentsIds = intersection(
          params.filterAssignmentsIds,
          accountIdsWithRole
        )
      }

      if (isEmpty(params.filterAssignmentsIds)) {
        // If no accountIds are found for the roles or no intersection is found, search for a dummy value which does
        // not exist which mimic the behavior of not returning any cases
        params.filterAssignmentsIds = ['DUMMY']
      }
    }

    if (
      params.filterAssignmentsIds != null &&
      params.filterAssignmentsIds?.length
    ) {
      alertConditions.push({
        $or: [
          ...this.getAssignmentFilter(
            'reviewAssignments',
            params.filterAssignmentsIds
          ),
          ...this.getAssignmentFilter(
            'assignments',
            params.filterAssignmentsIds
          ),
        ],
      })
    }
    if (params.filterRuleInstanceId != null) {
      alertConditions.push({
        'alerts.ruleInstanceId': { $in: params.filterRuleInstanceId },
      })
    }
    if (params.filterRuleQueueIds != null) {
      alertConditions.push(getRuleQueueFilter(params.filterRuleQueueIds))
    }

    if (params.filterOutAlertStatus && params.filterOutAlertStatus.length > 0) {
      alertConditions.push({
        'alerts.alertStatus': { $nin: params.filterOutAlertStatus },
      })
    }

    if (params.filterAlertStatus && params.filterAlertStatus.length > 0) {
      alertConditions.push({
        'alerts.alertStatus': { $in: params.filterAlertStatus },
      })
    }

    if (params.filterRuleNature && params.filterRuleNature.length > 0) {
      alertConditions.push({
        'alerts.ruleNature': {
          $in: params.filterRuleNature,
        },
      })
    }

    if (params.filterSlaPolicyId) {
      alertConditions.push({
        'alerts.slaPolicyDetails': {
          $elemMatch: { slaPolicyId: params.filterSlaPolicyId },
        },
      })
    }

    if (params.filterSlaPolicyStatus) {
      alertConditions.push({
        'alerts.slaPolicyDetails': {
          $elemMatch: { policyStatus: params.filterSlaPolicyStatus },
        },
      })
    }

    alertConditions.push({
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

    if (alertConditions.length > 0) {
      pipeline.push({
        $match: {
          $and: alertConditions,
        },
      })
    }

    pipeline.push({
      $unwind: {
        path: '$alerts',
      },
    })

    if (alertConditions.length > 0) {
      pipeline.push({
        $match: {
          $and: alertConditions,
        },
      })
    }

    if (!options?.countOnly) {
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

      if (!options?.excludeProject) {
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

      if (options?.hideTransactionIds) {
        pipeline.push({
          $project: {
            'alert.transactionIds': 0,
          },
        })
      }
    }
    return pipeline
  }

  public async getAlertById(alertId: string): Promise<Alert | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const result = await collection.findOne(
      { 'alerts.alertId': alertId },
      { projection: { alerts: 1 } }
    )

    if (!result) {
      return null
    }

    return result.alerts?.find((alert) => alert.alertId === alertId) ?? null
  }

  public async getNonClosedAlerts(): Promise<Alert[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const pipeline = [
      {
        $match: {
          alerts: {
            $elemMatch: { alertStatus: { $ne: 'CLOSED' } },
          },
        },
      },
      {
        $unwind: {
          path: '$alerts',
        },
      },
      {
        $match: {
          $and: [
            {
              'alerts.alertStatus': {
                $exists: true,
              },
            },
            {
              'alerts.alertStatus': {
                $ne: 'CLOSED',
              },
            },
          ],
        },
      },
      {
        $set: {
          alert: '$alerts',
        },
      },
      {
        $project: {
          alert: 1,
          _id: 0,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$alert', '$$ROOT'],
          },
        },
      },
      {
        $unset: 'alert',
      },
    ]
    const result = await collection.aggregate<Alert>(pipeline).toArray()
    return result
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

  public async validateAlertsQAStatus(
    alertIds: string[]
  ): Promise<Pick<Alert, 'alertId' | 'ruleChecklist'>[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const result = await collection
      .find({
        'alerts.alertId': { $in: alertIds },
        'alerts.ruleChecklist.qaStatus': null,
      })
      .project({ 'alerts.alertId': 1, 'alerts.ruleChecklist': 1 })
      .toArray()

    return result.flatMap((caseItem) => caseItem.alerts ?? [])
  }

  public async saveComment(
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

  public async markAllChecklistItemsAsDone(alertIds: string[]): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    await collection.updateMany(
      {
        'alerts.alertId': {
          $in: alertIds,
        },
        'alerts.ruleChecklist': {
          $ne: null,
        },
      },
      {
        $set: {
          'alerts.$[alert].ruleChecklist.$[item].done': 'DONE',
        },
      },
      {
        arrayFilters: [
          {
            'alert.alertId': {
              $in: alertIds,
            },
            'alert.ruleChecklist': {
              $exists: true,
              $ne: null,
            },
          },
          {
            'item.done': {
              $ne: 'DONE',
            },
            item: {
              $exists: true,
            },
          },
        ],
      }
    )
  }

  public async saveAlert(caseId: string, alert: Alert): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const now = Date.now()
    alert.updatedAt = now

    await collection.findOneAndUpdate(
      { caseId },
      { $set: { 'alerts.$[alert]': alert, updatedAt: now } },
      { arrayFilters: [{ 'alert.alertId': alert.alertId }] }
    )
  }

  public async updateAlertQACountInSampling(
    alert: Alert,
    qaStatus?: ChecklistStatus // In future if we have to revert the QA PASS/FAIL we will be sending qaStatus as undefined so that we can decrement the count
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<AlertsQaSampling>(
      ALERTS_QA_SAMPLING_COLLECTION(this.tenantId)
    )

    await collection.updateMany(
      { alertIds: alert.alertId as string },
      {
        $inc: {
          numberOfAlertsQaDone:
            alert.ruleQaStatus && !qaStatus
              ? -1
              : !alert.ruleQaStatus && qaStatus
              ? 1
              : 0,
        },
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
      { caseId: { $in: caseIds } },
      {
        $push: { 'alerts.$[alert].comments': commentToSave },
        $set: { updatedAt: now, 'alerts.$[alert].updatedAt': now },
      },
      { arrayFilters: [{ 'alert.alertId': { $in: alertIds } }] }
    )

    return commentToSave
  }

  public async deleteComment(
    caseId: string,
    alertId: string,
    commentId: string
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const now = Date.now()

    await collection.updateOne(
      { caseId, 'alerts.alertId': alertId },
      {
        $set: {
          'alerts.$[alert].comments.$[comment].deletedAt': now,
          updatedAt: now,
          'alerts.$[alert].updatedAt': now,
        },
      },
      {
        arrayFilters: [
          { 'alert.alertId': alertId },
          {
            $or: [
              { 'comment.id': commentId },
              { 'comment.parentId': commentId },
            ],
          },
        ],
      }
    )
  }

  public async updateStatus(
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
    if (alert.transactionIds == null) {
      throw new NotFound(`Alert "${params.alertId}" does not have transactions`)
    }

    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const result = await transactionsRepo.getTransactionsCursorPaginate({
      alertId: alert.alertId,
      pageSize: params.pageSize,
      afterTimestamp: params.afterTimestamp || 0,
      beforeTimestamp: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
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
      filterDestinationCountries: params.filterDestinationCountries,
      filterOriginCountries: params.filterOriginCountries,
    })

    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    if (hasFeature('RISK_SCORING')) {
      result.items = await riskRepository.augmentRiskLevel(result.items)
    }

    return result
  }

  public async updateReviewAssignments(
    alertIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    return this.updateReviewAssigneeToAlertsPrivate(alertIds, reviewAssignments)
  }

  public async updateAssignments(
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

  public async updateReviewAssignmentsToAssignments(
    alertIds: string[]
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
                          assignments: '$$alert.reviewAssignments',
                          updatedAt: now,
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
  }

  public async updateInReviewAssignments(
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

  public async reassignAlerts(
    assignmentId: string,
    reassignToUserId: string
  ): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const user = getContext()?.user as Account

    const now = Date.now()
    const assignments: Assignment[] = [
      {
        assigneeUserId: reassignToUserId,
        assignedByUserId: user.id,
        timestamp: now,
      },
    ]

    const keys: (keyof Alert)[] = [
      'assignments',
      'reviewAssignments',
      'qaAssignment',
    ]

    const promises = keys.map((key) => {
      return collection.updateMany(
        {
          [`alerts.${key}.assigneeUserId`]: assignmentId,
        },
        {
          $set: {
            [`alerts.$[alert].${key}`]: assignments,
            updatedAt: now,
          },
        },
        {
          arrayFilters: [
            {
              [`alert.${key}.assigneeUserId`]: assignmentId,
              [`alert.${key}`]: {
                $size: 1,
              },
            },
          ],
        }
      )
    })

    const pullPromises = keys.map((key) => {
      return collection.updateMany(
        {
          [`alerts.${key}.assigneeUserId`]: assignmentId,
        },
        {
          $pull: {
            [`alerts.$[alert].${key}`]: {
              assigneeUserId: assignmentId,
            },
          },
        },
        {
          arrayFilters: [
            {
              [`alert.${key}.assigneeUserId`]: assignmentId,
              [`alert.${key}.1`]: {
                $exists: true,
              },
            },
          ],
        }
      )
    })

    await Promise.all([...promises, ...pullPromises])
  }

  public async updateRuleQueue(ruleInstanceId: string, ruleQueueId?: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    await collection.updateMany(
      {
        'alerts.ruleInstanceId': {
          $eq: ruleInstanceId,
        },
      },
      {
        $set: {
          'alerts.$[alert].ruleQueueId': ruleQueueId,
        },
      },
      {
        arrayFilters: [
          {
            'alert.ruleInstanceId': {
              $eq: ruleInstanceId,
            },
          },
        ],
      }
    )
  }

  public async deleteRuleQueue(ruleQueueId: string) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    await collection.updateMany(
      {
        'alerts.ruleQueueId': {
          $eq: ruleQueueId,
        },
      },
      {
        $set: {
          'alerts.$[alert].ruleQueueId': undefined,
        },
      },
      {
        arrayFilters: [
          {
            'alert.ruleQueueId': {
              $eq: ruleQueueId,
            },
          },
        ],
      }
    )
  }

  public async getAlertsCount(query: Document[]): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const pipeline = [...query, { $count: 'count' }]

    const result = await collection
      .aggregate<{ count: number }>(pipeline)
      .next()

    return result?.count ?? 0
  }

  public async getAlertsForQA(query: Document[], sampleSize: number) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const pipeline = [
      ...query,
      { $sample: { size: sampleSize } },
      { $project: { 'alerts.alertId': 1 } },
    ]

    return collection.aggregate(pipeline).toArray()
  }

  public async getSampleIdForQA(): Promise<number> {
    return new CounterRepository(
      this.tenantId,
      this.mongoDb
    ).getNextCounterAndUpdate('AlertQASample')
  }

  public async saveQASampleData(data: AlertsQaSampling) {
    const db = this.mongoDb.db()
    const collection = db.collection<AlertsQaSampling>(
      ALERTS_QA_SAMPLING_COLLECTION(this.tenantId)
    )

    await collection.insertOne(data)

    return data
  }

  public async updateQASampleData(data: AlertsQaSampling) {
    const db = this.mongoDb.db()
    const collection = db.collection<AlertsQaSampling>(
      ALERTS_QA_SAMPLING_COLLECTION(this.tenantId)
    )

    await collection.updateOne({ samplingId: data.samplingId }, { $set: data })

    return data
  }

  public async getSamplingData(
    params: DefaultApiGetAlertsQaSamplingRequest
  ): Promise<{
    data: AlertsQaSampling[]
    total: number
  }> {
    const db = this.mongoDb.db()
    const collection = db.collection<AlertsQaSampling>(
      ALERTS_QA_SAMPLING_COLLECTION(this.tenantId)
    )

    const pipeline: Document[] = []

    if (params.filterSampleId) {
      pipeline.push({
        $match: {
          sampleId: prefixRegexMatchFilter(params.filterSampleId),
        },
      })
    }

    if (params.filterSampleName) {
      pipeline.push({
        $match: {
          samplingName: prefixRegexMatchFilter(params.filterSampleName),
        },
      })
    }

    if (params.filterCreatedById) {
      pipeline.push({
        $match: {
          createdBy: params.filterCreatedById,
        },
      })
    }

    if (params.filterPriority?.length) {
      pipeline.push({
        $match: {
          priority: {
            $in: params.filterPriority,
          },
        },
      })
    }

    if (
      params.filterCreatedAfterTimestamp != null &&
      params.filterCreatedBeforeTimestamp != null
    ) {
      pipeline.push({
        $match: {
          createdAt: {
            $gte: params.filterCreatedAfterTimestamp,
            $lte: params.filterCreatedBeforeTimestamp,
          },
        },
      })
    }

    if (params.filterDescription) {
      pipeline.push({
        $match: {
          samplingDescription: prefixRegexMatchFilter(params.filterDescription),
        },
      })
    }

    pipeline.push({
      $sort: {
        [params?.sortField ?? 'createdAt']:
          params?.sortOrder === 'ascend' ? 1 : -1,
      },
    })

    pipeline.push(...paginatePipeline(params))

    const [data, total] = await Promise.all([
      collection.aggregate<AlertsQaSampling>(pipeline).toArray(),
      collection.aggregate<{ count: number }>([{ $count: 'count' }]).next(),
    ])

    return {
      data: data,
      total: total?.count ?? 0,
    }
  }

  public async getSamplingDataById(
    sampleId: string
  ): Promise<AlertsQaSampling | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<AlertsQaSampling>(
      ALERTS_QA_SAMPLING_COLLECTION(this.tenantId)
    )

    const result = await collection.findOne({
      samplingId: sampleId,
    })

    return result
  }

  public async getSamplingIds(): Promise<AlertsQASampleIds[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<AlertsQaSampling>(
      ALERTS_QA_SAMPLING_COLLECTION(this.tenantId)
    )

    const result: AlertsQaSampling[] = await collection
      .find({}, { projection: { samplingId: 1, samplingName: 1 } })
      .toArray()

    return compact(
      result.map((item) => ({
        samplingId: item.samplingId,
        samplingName: item.samplingName,
      }))
    )
  }

  public async deleteSample(sampleId: string): Promise<void> {
    const db = this.mongoDb.db()
    const collection = db.collection<AlertsQaSampling>(
      ALERTS_QA_SAMPLING_COLLECTION(this.tenantId)
    )

    await collection.deleteOne({ samplingId: sampleId })
  }

  public async addAlertToMongo(
    caseId: string,
    alert: Alert,
    caseData: { caseAggregates: CaseAggregates; caseTransactionsIds: string[] }
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const { caseAggregates, caseTransactionsIds } = caseData

    await collection.updateOne(
      { caseId },
      {
        $push: { alerts: alert },
        $set: {
          updatedAt: Date.now(),
          caseAggregates,
          caseTransactionsIds,
          caseTransactionsCount: caseTransactionsIds.length,
        },
      }
    )
  }

  public async updateAlertInMongo(
    caseId: string,
    alertId: string,
    data: Partial<Alert>,
    caseData: { caseAggregates?: CaseAggregates; caseTransactionIds?: string[] }
  ): Promise<Case> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const updatedCaseData = await collection.findOneAndUpdate(
      { caseId, 'alerts.alertId': alertId },
      {
        $set: {
          ...Object.entries(data).reduce((acc, [key, value]) => {
            acc[`alerts.$.${key}`] = value
            return acc
          }, {} as Record<string, unknown>),
          updatedAt: Date.now(),
          ...(caseData.caseAggregates && {
            caseAggregates: caseData.caseAggregates,
          }),
          ...(caseData.caseTransactionIds && {
            caseTransactionsIds: caseData.caseTransactionIds,
          }),
          ...(caseData.caseTransactionIds && {
            caseTransactionsCount: caseData.caseTransactionIds.length,
          }),
        },
      },
      { returnDocument: 'after' }
    )

    return updatedCaseData.value as Case
  }

  public async getRuleInstanceStats(
    ruleInstanceId: string,
    timeRange: { afterTimestamp: number; beforeTimestamp: number }
  ) {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const FALSE_POSITIVE_REASON: CaseReasons = 'False positive'
    const timezone = dayjsLib.tz.guess()
    const pipeline = [
      {
        $match: {
          'alerts.ruleInstanceId': ruleInstanceId,
          'alerts.createdTimestamp': {
            $gte: timeRange.afterTimestamp,
            $lte: timeRange.beforeTimestamp,
          },
        },
      },
      {
        $unwind: '$alerts',
      },
      {
        $match: {
          'alerts.ruleInstanceId': ruleInstanceId,
          'alerts.createdTimestamp': {
            $gte: timeRange.afterTimestamp,
            $lte: timeRange.beforeTimestamp,
          },
        },
      },
      {
        $project: {
          createdTimestamp: '$alerts.createdTimestamp',
          alertStatus: '$alerts.alertStatus',
          isFalsePositive: {
            $in: [
              FALSE_POSITIVE_REASON,
              { $ifNull: ['$alerts.lastStatusChange.reason', []] },
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: DAY_DATE_FORMAT,
                date: { $toDate: '$createdTimestamp' },
                timezone: timezone,
              },
            },
          },
          alertsCreated: { $sum: 1 },
          falsePositiveAlerts: {
            $sum: {
              $cond: {
                if: { $eq: ['$isFalsePositive', true] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          alertsCreated: 1,
          falsePositiveAlerts: 1,
        },
      },
      {
        $sort: {
          date: 1,
        },
      },
    ]

    return collection.aggregate<RuleInstanceAlertsStats>(pipeline).toArray()
  }
}
