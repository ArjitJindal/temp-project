import { Document, Filter, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { NotFound } from 'http-errors'
import { CaseRepository } from './case-repository'
import { MongoDbTransactionRepository } from './mongodb-transaction-repository'
import {
  ACCOUNTS_COLLECTION,
  CASES_COLLECTION,
  lookupPipelineStage,
  paginatePipeline,
  prefixRegexMatchFilter,
} from '@/utils/mongoDBUtils'
import {
  COUNT_QUERY_LIMIT,
  OptionalPagination,
  OptionalPaginationParams,
} from '@/utils/pagination'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetAlertTransactionListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Case } from '@/@types/openapi-internal/Case'
import { AlertListResponseItem } from '@/@types/openapi-internal/AlertListResponseItem'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Comment } from '@/@types/openapi-internal/Comment'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { hasFeature } from '@/core/utils/context'
import { TransactionsListResponse } from '@/@types/openapi-internal/TransactionsListResponse'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'

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
      await caseRepository.getCasesConditions(params, false)

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

    if (params.filterRulesHit?.length) {
      conditions.push({
        'alerts.ruleInstanceId': {
          $in: params.filterRulesHit,
        },
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
        'alerts.lastStatusChange.timestamp': {
          $lte: params.beforeAlertLastUpdatedTimestamp,
          $gte: params.afterAlertLastUpdatedTimestamp,
        },
      })
    }

    if (params.filterOriginPaymentMethod) {
      conditions.push({
        'alerts.originPaymentMethods': {
          $in: params.filterOriginPaymentMethod as PaymentMethod[],
        },
      })
    }
    if (params.filterDestinationPaymentMethod) {
      conditions.push({
        'alerts.destinationPaymentMethods': {
          $in: params.filterDestinationPaymentMethod as PaymentMethod[],
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

    if (
      params.filterAssignmentsIds != null &&
      params.filterAssignmentsIds?.length
    ) {
      conditions.push({
        'alerts.assignments': {
          $elemMatch: {
            assigneeUserId: { $in: params.filterAssignmentsIds },
          },
        },
      })
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
    const { data } = await this.getAlerts({
      filterAlertId: alertId,
      page: 1,
      pageSize: 1,
    })

    return data?.find((c) => c.alert.alertId === alertId)?.alert ?? null
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
      { $push: { 'alerts.$[alert].comments': commentToSave } },
      { arrayFilters: [{ 'alert.alertId': alertId }] }
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
            { caseId: caseItem.caseId },
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

  public async getAlertTransactionsHit(
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

    const result = await transactionsRepo.getTransactions({
      filterIdList: alert.transactionIds,
      afterTimestamp: 0,
      beforeTimestamp: Number.MAX_SAFE_INTEGER,
      page: params.page,
      pageSize: params.pageSize,
    })

    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    if (hasFeature('PULSE')) {
      result.data = await riskRepository.augmentRiskLevel(result.data)
    }

    return result
  }

  public async getAlertTransactionsExecuted(
    alertId: string,
    params: OptionalPagination<DefaultApiGetAlertTransactionListRequest>
  ): Promise<TransactionsListResponse> {
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    const case_ = await caseRepository.getCaseByAlertId(alertId)

    if (case_ == null) {
      throw new NotFound(`Case not found for alert "${alertId}"`)
    }

    const alert = case_.alerts?.find((a) => a.alertId === alertId)
    if (alert == null) {
      throw new NotFound(`Alert "${alertId}" not found `)
    }

    const userId =
      case_?.caseUsers?.origin?.userId ?? case_?.caseUsers?.destination?.userId

    if (!userId) {
      throw new NotFound(`User not found for case "${case_.caseId}"`)
    }

    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    let transactions = await transactionsRepo.getExecutedTransactionsOfAlert(
      userId,
      alert.ruleInstanceId,
      { page: params.page, pageSize: params.pageSize }
    )

    const riskRepository = new RiskRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })

    const transactionsCount =
      await transactionsRepo.getExecutedTransactionsOfAlertCount(
        userId,
        alert.ruleInstanceId
      )

    if (hasFeature('PULSE')) {
      transactions = await riskRepository.augmentRiskLevel(transactions)
    }

    return {
      total: transactionsCount,
      data: transactions,
    }
  }
}
