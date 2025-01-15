import { AggregationCursor, Document, Filter, MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import {
  cloneDeep,
  compact,
  difference,
  intersection,
  isEmpty,
  last,
  uniq,
  uniqBy,
} from 'lodash'
import dayjsLib from '@flagright/lib/utils/dayjs'
import { replaceMagicKeyword } from '@flagright/lib/utils'
import { CaseRepository, getRuleQueueFilter } from '../cases/repository'
import { DynamoAlertRepository } from './dynamo-repository'
import { ClickhouseAlertRepository } from './clickhouse-repository'
import {
  convertQueryToAggregationExpression,
  DAY_DATE_FORMAT,
  getSkipAndLimit,
  internalMongoUpdateMany,
  internalMongoUpdateOne,
  paginatePipeline,
  prefixRegexMatchFilter,
} from '@/utils/mongodb-utils'
import {
  ALERTS_QA_SAMPLING_COLLECTION,
  CASES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { COUNT_QUERY_LIMIT, OptionalPagination } from '@/utils/pagination'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetAlertsQaSamplingRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { Case } from '@/@types/openapi-internal/Case'
import { AlertListResponseItem } from '@/@types/openapi-internal/AlertListResponseItem'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Comment } from '@/@types/openapi-internal/Comment'
import { getContext, hasFeature } from '@/core/utils/context'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Assignment } from '@/@types/openapi-internal/Assignment'
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
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'
import { ChecklistItemValue } from '@/@types/openapi-internal/ChecklistItemValue'

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
  dynamoAlertRepository: DynamoAlertRepository

  constructor(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb?: DynamoDBDocumentClient }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.tenantId = tenantId
    this.dynamoAlertRepository = new DynamoAlertRepository(
      tenantId,
      this.dynamoDb
    )
  }

  public async getAlerts(
    params: AlertParams,
    options?: { hideTransactionIds?: boolean }
  ): Promise<AlertListResponse> {
    let result: AlertListResponse

    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    if (isClickhouseEnabled() && hasFeature('ALERTS_DYNAMO_POC')) {
      const clickhouseRepository = new ClickhouseAlertRepository(
        await getClickhouseClient(this.tenantId)
      )

      const { data, total } = await clickhouseRepository.getAlerts(params)

      const alerts = await this.dynamoAlertRepository.getAlerts(
        data.map((alert) => alert.id as string)
      )

      const alertMap = new Map<string, Alert>()

      alerts.forEach((a) => alertMap.set(a.alertId as string, a))

      const caseIds = alerts.map((alert) => alert.caseId)

      // TODO: We should get rid of this as soon as possible
      const cases = await collection
        .find({ caseId: { $in: uniq(caseIds) } })
        .toArray()

      const caseMap = new Map<string, Case>()

      cases.forEach((c) => caseMap.set(c.caseId as string, c))

      result = {
        total,
        data: alerts.map((alert) => ({
          alert,
          caseType: caseMap.get(alert.caseId as string)?.caseType as CaseType,
          caseCreatedTimestamp: caseMap.get(alert.caseId as string)
            ?.createdTimestamp as number,
          caseUsers: caseMap.get(alert.caseId as string)
            ?.caseUsers as CaseCaseUsers,
        })),
      }
    } else if (!hasFeature('PNB')) {
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
      const cursor = collection.aggregate<AlertListResponseItem>(
        itemsPipeline,
        {
          allowDiskUse: true,
        }
      )
      const itemsPromise = cursor.toArray()
      const countPromise = collection
        .aggregate<{ count: number }>(countPipeline)
        .next()
        .then((item) => item?.count ?? 0)

      const sortedSlaAlerts = await itemsPromise
      sortedSlaAlerts.forEach((alert) => {
        if (alert.alert?.slaPolicyDetails) {
          alert.alert.slaPolicyDetails.sort((a, b) => {
            const aTime = a?.elapsedTime ?? 0
            const bTime = b?.elapsedTime ?? 0
            return bTime - aTime
          })
        }
      })
      result = {
        total: await countPromise,
        data: await itemsPromise,
      }
    } else {
      /* Getting count */
      const alertsCountPipeline = [
        ...(await this.getAlertsPipeline(params, {
          hideTransactionIds: options?.hideTransactionIds,
          countOnly: true,
          enablePerformanceWorkaround: true,
        })),
        {
          $limit: COUNT_QUERY_LIMIT,
        },
        {
          $count: 'count',
        },
      ]
      const casesCountPipeline = [
        ...alertsCountPipeline.slice(
          0,
          alertsCountPipeline.findIndex((stage) => stage.$unwind)
        ),
        {
          $limit: COUNT_QUERY_LIMIT,
        },
        {
          $count: 'count',
        },
      ]
      // Don't await count here
      const alertsCountPromise = collection
        .aggregate<{ count: number }>(alertsCountPipeline)
        .next()
        .then((item) => item?.count ?? 0)
      const casesCountPromise = collection
        .aggregate<{ count: number }>(casesCountPipeline)
        .next()
        .then((item) => item?.count ?? 0)

      /* Get paginated alerts */
      const { skip, limit } = getSkipAndLimit(params)
      if (
        !params.sortField &&
        params.filterAlertStatus &&
        !params.filterAlertStatus?.includes('CLOSED')
      ) {
        params.sortField = 'createdTimestamp'
      }
      const pipeline = await this.getAlertsPipeline(params, {
        hideTransactionIds: options?.hideTransactionIds,
        countOnly: false,
        enablePerformanceWorkaround: true,
      })
      /**
       * We're being "creative" here to get around the query performance issue
       * if sorting is applied, as index cannot be used after $unwind.
       * Steps:
       * 1. Sort the cases before unwind
       * 2. Do skip/limit before unwind (case level)
       * 3. unwind alerts
       * 4. Sort the alerts again (alert level)
       * 5. As the first page alerts could contain the ones we don't want,
       *    we get the first alert of the next page and use it as the boundary
       *    to filter out the alerts in the first page that we don't want.
       *
       * By using this way, we can still use the index created for `alerts` fields.
       * The downside is that we could have more than pageSize alerts in the result
       * (we cannot just cut the extra ones, otherwise the next page could be incorrect)
       */
      pipeline.splice(
        pipeline.findIndex((stage) => stage.$unwind),
        0,
        { $skip: skip },
        { $limit: limit }
      )
      const alertsPromise = collection
        .aggregate<AlertListResponseItem>(pipeline, { allowDiskUse: true })
        .toArray()
      let nextPageAlertsPromise: Promise<AlertListResponseItem[]> | undefined
      if (params.sortField) {
        const pipeline2 = cloneDeep(pipeline)
        pipeline2[pipeline2.findIndex((stage) => '$skip' in stage)].$skip +=
          limit
        pipeline2[pipeline2.findIndex((stage) => '$limit' in stage)].$limit = 1
        nextPageAlertsPromise = collection
          .aggregate<AlertListResponseItem>(pipeline2, { allowDiskUse: true })
          .toArray()
      }
      const [alerts, nextPageAlerts] = await Promise.all([
        alertsPromise,
        nextPageAlertsPromise,
      ])

      let filteredAlerts = alerts
      if (nextPageAlerts && nextPageAlerts.length > 0 && params.sortField) {
        const sortField = params.sortField
        const nextPageSortFieldValue = nextPageAlerts[0].alert[sortField]
        if (nextPageSortFieldValue) {
          filteredAlerts = alerts.filter((alert) =>
            params.sortOrder === 'ascend'
              ? alert.alert[sortField] <= nextPageSortFieldValue
              : alert.alert[sortField] >= nextPageSortFieldValue
          )
        }
      }
      // As we paginate the cases not alerts, the previous pages could contain the alerts that should be in the current page
      // Find them and add them to the current page
      if (params.sortField && skip > 0) {
        const firstSortFieldValue = filteredAlerts[0]?.alert[params.sortField]
        const lastSortFieldValue = last(filteredAlerts)?.alert[params.sortField]
        const gte =
          params.sortOrder === 'ascend'
            ? firstSortFieldValue
            : lastSortFieldValue
        const lte =
          params.sortOrder === 'ascend'
            ? lastSortFieldValue
            : firstSortFieldValue
        const pipeline3 = await this.getAlertsPipeline(params, {
          hideTransactionIds: options?.hideTransactionIds,
          countOnly: false,
          extraAlertsFilterConditions: [
            {
              [`alerts.${params.sortField}`]: {
                $gte: gte,
                $lte: lte,
              },
            },
          ],
          enablePerformanceWorkaround: true,
        })
        const unwindIndex = pipeline3.findIndex((stage) => stage.$unwind)
        pipeline3.splice(unwindIndex - 1, 0, { $limit: skip })
        const missedPrevAlerts = await collection
          .aggregate<AlertListResponseItem>(pipeline3, { allowDiskUse: true })
          .toArray()
        filteredAlerts = filteredAlerts.concat(missedPrevAlerts)
      }

      filteredAlerts.forEach((alert) => {
        if (alert.alert?.slaPolicyDetails) {
          alert.alert.slaPolicyDetails.sort((a, b) => {
            const aTime = a?.elapsedTime ?? 0
            const bTime = b?.elapsedTime ?? 0
            return bTime - aTime
          })
        }
      })

      result = {
        total: await alertsCountPromise,
        totalPages: Math.ceil((await casesCountPromise) / limit),
        data: uniqBy(filteredAlerts, (v) => v.alert.alertId),
      }
    }

    return {
      ...result,
      data: result.data.map((item) => ({
        ...item,
        alert: {
          ...item.alert,
          comments: item.alert.comments?.filter((comment) => {
            return !(comment.deletedAt != null)
          }),
        },
      })),
    }
  }

  public async updateAISummary(
    alertId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ) {
    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.updateAISummary(
        alertId,
        commentId,
        fileS3Key,
        summary
      )
    }

    await this.updateOneAlert(
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

  public async getCasesByAssigneeId(assigneeId: string): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return casesCollection
      .find({
        'alerts.assignments.assigneeUserId': assigneeId,
        'alerts.alertStatus': {
          $nin: ['CLOSED', 'REJECTED', 'ARCHIVED'] as AlertStatus[], // end game statuses
        },
      })
      .toArray()
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
      extraAlertsFilterConditions?: Document[]
      enablePerformanceWorkaround?: boolean
    }
  ): Promise<Document[]> {
    const sortField = params?.sortField
      ? params.sortField === 'caseCreatedTimestamp'
        ? 'createdTimestamp'
        : `alerts.${params.sortField}`
      : undefined
    const sortStage = sortField
      ? {
          $sort: {
            [sortField]: params?.sortOrder === 'ascend' ? 1 : -1,
          },
        }
      : undefined

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

    if (params.filterCaseId != null) {
      caseConditions.push({
        caseId: params.filterCaseId,
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
      const exactMatch = { 'alerts.alertId': params.filterAlertId }
      const partialMatch = {
        'alerts.alertId': prefixRegexMatchFilter(params.filterAlertId),
      }

      alertConditions.push({
        $or: [
          exactMatch,
          {
            $and: [
              { 'alerts.alertId': { $nin: [params.filterAlertId] } },
              partialMatch,
            ],
          },
        ],
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

    if (params.filterAssignmentsRoles?.length) {
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

    if (
      params.filterAlertSlaPolicyId &&
      params.filterAlertSlaPolicyId.length > 0
    ) {
      alertConditions.push({
        'alerts.slaPolicyDetails': {
          $elemMatch: {
            $and: [
              {
                slaPolicyId: { $in: params.filterAlertSlaPolicyId },
              },
              {
                policyStatus: { $exists: true },
              },
            ],
          },
        },
      })
    }

    if (
      params.filterAlertSlaPolicyStatus &&
      params.filterAlertSlaPolicyStatus.length > 0
    ) {
      alertConditions.push({
        'alerts.slaPolicyDetails': {
          $elemMatch: {
            policyStatus: { $in: params.filterAlertSlaPolicyStatus },
          },
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
          alerts: {
            $elemMatch: {
              $and: replaceMagicKeyword(alertConditions, 'alerts.', ''),
            },
          },
        },
      })
      if (options?.enablePerformanceWorkaround) {
        pipeline.push({
          $addFields: {
            alerts: {
              $filter: {
                input: '$alerts',
                as: 'alert',
                cond: convertQueryToAggregationExpression({
                  $and: replaceMagicKeyword(
                    alertConditions,
                    'alerts.',
                    'alert.'
                  ),
                }),
              },
            },
          },
        })
      }
    }

    if (!options?.countOnly && sortStage) {
      pipeline.push(sortStage)
    }

    if (options?.extraAlertsFilterConditions?.length) {
      pipeline.push({
        $match: {
          $and: options.extraAlertsFilterConditions,
        },
      })
      alertConditions.push(...options.extraAlertsFilterConditions)
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
      if (sortStage) {
        pipeline.push(sortStage)
      }
      pipeline.push({
        $set: {
          alert: '$alerts',
          caseCreatedTimestamp: '$createdTimestamp',
        },
      })

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

  public getNonClosedAlertsCursor(): AggregationCursor<Alert> {
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
    return collection.aggregate<Alert>(pipeline)
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
    // TODO: Add dynamo update
    await this.updateManyAlerts(
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

  public async updateAlertSlaPolicyDetails(
    alertIds: string[],
    slaPolicyDetails: SLAPolicyDetails[]
  ): Promise<void> {
    await this.updateManyAlerts(
      { 'alerts.alertId': { $in: alertIds } },
      {
        $set: {
          'alerts.$[alert].slaPolicyDetails': slaPolicyDetails,
        },
      },
      { arrayFilters: [{ 'alert.alertId': { $in: alertIds } }] }
    )
  }

  public async updateAlertChecklistStatus(
    alertId: string,
    updatedChecklist: ChecklistItemValue[]
  ): Promise<void> {
    await this.updateOneAlert(
      { 'alerts.alertId': alertId },
      {
        $set: {
          'alerts.$[alert].ruleChecklist': updatedChecklist,
          'alerts.$[alert].updatedAt': Date.now(),
        },
      },
      { arrayFilters: [{ 'alert.alertId': alertId }] }
    )
  }

  public async updateAlertQaStatus(
    alertId: string,
    qaStatus: ChecklistStatus,
    comment: Comment,
    assignments?: Assignment[]
  ): Promise<void> {
    await this.updateOneAlert(
      { 'alerts.alertId': alertId },
      {
        $set: {
          'alerts.$[alert].ruleQaStatus': qaStatus,
          'alerts.$[alert].assignments': assignments,
          'alerts.$[alert].updatedAt': Date.now(),
        },
        $push: {
          'alerts.$[alert].comments': comment,
        },
      },
      {
        arrayFilters: [{ 'alert.alertId': alertId }],
      }
    )
  }

  public async updateAlertQaAssignments(
    alertId: string,
    assignments: Assignment[]
  ): Promise<void> {
    await this.updateOneAlert(
      { 'alerts.alertId': alertId },
      { $set: { 'alerts.$[alert].qaAssignment': assignments } }
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
    const now = Date.now()

    const commentToSave: Comment = {
      ...comment,
      id: comment.id || uuidv4(),
      createdAt: comment.createdAt ?? now,
      updatedAt: now,
    }

    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.saveAlertsComment(
        alertIds,
        commentToSave
      )
    }

    await this.updateManyAlerts(
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
    const now = Date.now()

    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.deleteComment(alertId, commentId)
    }

    await this.updateOneAlert(
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

    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.updateStatus(
        alertIds,
        statusChange,
        isLastInReview
      )
    }

    await this.updateManyAlerts(
      {
        caseId: { $in: caseIds },
        'alerts.alertId': { $in: alertIds },
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
      .find({ caseId: { $in: caseIds } })
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

  public async updateAssignments(
    alertIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    const now = Date.now()

    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.updateAssignments(alertIds, assignments)
    }

    await this.updateManyAlerts(
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

  public async updateReviewAssignmentsToAssignments(
    alertIds: string[]
  ): Promise<void> {
    const now = Date.now()

    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.updateReviewAssignmentsToAssignments(
        alertIds
      )
    }

    await this.updateManyAlerts(
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
    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.updateInReviewAssignments(
        alertIds,
        assignments,
        reviewAssignments
      )
    }

    await this.updateManyAlerts(
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
        arrayFilters: [{ 'alert.alertId': { $in: alertIds } }],
      }
    )
  }

  public async updateReviewAssignments(
    alertIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    const now = Date.now()

    if (hasFeature('ALERTS_DYNAMO_POC')) {
      await this.dynamoAlertRepository.updateReviewAssignments(
        alertIds,
        reviewAssignments
      )
    }

    await this.updateManyAlerts(
      {
        'alerts.alertId': {
          $in: alertIds,
        },
      },
      {
        $set: {
          'alerts.$[alert].reviewAssignments': reviewAssignments,
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
    // TODO: FETCH FROM CLICKHOUSE AND UPDATE IN DYNAMODB RESPECTIVELY
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
      return this.updateManyAlerts(
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
      return this.updateManyAlerts(
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
    // TODO: FETCH FROM CLICKHOUSE AND UPDATE IN DYNAMODB RESPECTIVELY
    await this.updateManyAlerts(
      { 'alerts.ruleInstanceId': { $eq: ruleInstanceId } },
      {
        $set: {
          'alerts.$[alert].ruleQueueId': ruleQueueId,
        },
      },
      {
        arrayFilters: [{ 'alert.ruleInstanceId': { $eq: ruleInstanceId } }],
      }
    )
  }

  public async deleteRuleQueue(ruleQueueId: string) {
    // TODO: FETCH FROM CLICKHOUSE AND UPDATE IN DYNAMODB RESPECTIVELY
    await this.updateManyAlerts(
      { 'alerts.ruleQueueId': { $eq: ruleQueueId } },
      {
        $set: {
          'alerts.$[alert].ruleQueueId': undefined,
        },
      },
      {
        arrayFilters: [{ 'alert.ruleQueueId': { $eq: ruleQueueId } }],
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
    const { caseAggregates, caseTransactionsIds } = caseData

    await this.updateOneAlert(
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

  private async updateManyAlerts(
    filter: Filter<Case>,
    update: Document,
    options?: { arrayFilters?: Document[] }
  ): Promise<void> {
    await internalMongoUpdateMany(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      filter,
      update,
      options
    )
  }

  private async updateOneAlert(
    filter: Filter<Case>,
    update: Document,
    options?: { arrayFilters?: Document[] }
  ): Promise<void> {
    await internalMongoUpdateOne(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      filter,
      update,
      options
    )
  }
}
