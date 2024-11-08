import { v4 as uuidv4 } from 'uuid'
import {
  AggregationCursor,
  Document,
  Filter,
  ModifyResult,
  MongoClient,
  UpdateFilter,
  UpdateResult,
} from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { difference, intersection, isEmpty, isNil, omitBy } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk'
import { TimeRange } from '../rules-engine/repositories/transaction-repository-interface'
import {
  internalMongoInsert,
  internalMongoReplace,
  lookupPipelineStage,
  paginatePipeline,
  prefixRegexMatchFilter,
  internalMongoUpdateMany,
  internalMongoUpdateOne,
  withTransaction,
} from '@/utils/mongodb-utils'
import {
  ACCOUNTS_COLLECTION,
  CASES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Priority } from '@/@types/openapi-internal/Priority'
import { Tag } from '@/@types/openapi-public/Tag'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { getContext, hasFeature } from '@/core/utils/context'
import { COUNT_QUERY_LIMIT, OptionalPagination } from '@/utils/pagination'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { traceable } from '@/core/xray'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentDetailsIdentifiers } from '@/core/dynamodb/dynamodb-keys'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { shouldUseReviewAssignments } from '@/utils/helpers'
import { Account } from '@/@types/openapi-internal/Account'
import { CounterRepository } from '@/services/counter/repository'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { AccountsService } from '@/services/accounts'

export type CaseWithoutCaseTransactions = Omit<Case, 'caseTransactions'>

export const MAX_TRANSACTION_IN_A_CASE = 50_000

export function getRuleQueueFilter(ruleQueueIds: string[]) {
  return {
    $or: [
      {
        'alerts.ruleQueueId': { $in: ruleQueueIds },
      },
      ruleQueueIds.includes('default')
        ? {
            'alerts.ruleQueueId': { $eq: null },
          }
        : {},
    ].filter((v) => !isEmpty(v)),
  }
}

export type CaseListOptions = {
  includeCaseTransactionIds?: boolean
  hideOptionalData?: boolean
}

export type SubjectCasesQueryParams = {
  directions?: ('ORIGIN' | 'DESTINATION')[]
  filterMaxTransactions?: number
  filterOutCaseStatus?: CaseStatus
  filterTransactionId?: string
  filterAvailableAfterTimestamp?: (number | undefined)[]
  filterCaseType?: CaseType
}
@traceable
export class CaseRepository {
  mongoDb: MongoClient
  tenantId: string
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb?: MongoClient; dynamoDb?: DynamoDBDocumentClient }
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

  public async getCaseIdsByUserId(
    userId: string,
    params?: {
      caseType?: CaseType
    }
  ): Promise<{ caseId?: string }[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const filters: Filter<Case>[] = []

    if (params?.caseType != null) {
      filters.push({
        caseType: params.caseType,
      })
    }

    filters.push({
      $or: [
        { 'caseUsers.origin.userId': userId },
        { 'caseUsers.destination.userId': userId },
      ],
    })

    const cases = await casesCollection
      .find(
        { $and: filters.length > 0 ? filters : [{}] },
        { projection: { caseId: 1 } }
      )
      .toArray()

    return cases as { caseId?: string }[]
  }

  public async updateManualCase(
    caseId: string,
    transactions: InternalTransaction[],
    comment: Comment,
    transactionsCount: number
  ): Promise<Case | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const updatedCase = await collection.findOneAndUpdate(
      { caseId },
      {
        $push: {
          comments: comment,
          caseTransactionsIds: {
            $each: transactions.map((transaction) => transaction.transactionId),
          },
        },
        $set: {
          updatedAt: Date.now(),
          caseTransactionsCount: transactionsCount,
        },
      },
      { returnDocument: 'after' }
    )

    return updatedCase.value
  }

  async addCaseMongo(caseEntity: Case): Promise<Case> {
    const counterRepository = new CounterRepository(this.tenantId, this.mongoDb)
    await withTransaction(async () => {
      const casesCollectionName = CASES_COLLECTION(this.tenantId)

      if (!caseEntity.caseId) {
        const caseCount = await counterRepository.getNextCounterAndUpdate(
          'Case'
        )

        caseEntity.caseId = `C-${caseCount}`
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

            const alertCount = await counterRepository.getNextCounterAndUpdate(
              'Alert'
            )

            return {
              ...alert,
              _id: alert._id ?? alertCount,
              alertId: alert.alertId ?? `A-${alertCount}`,
              caseId: caseEntity.caseId,
            }
          })
        )
      }

      await internalMongoReplace(
        this.mongoDb,
        casesCollectionName,
        { caseId: caseEntity.caseId },
        caseEntity
      )
    })

    return caseEntity
  }

  private async updateManyCases(
    filter: Filter<Case>,
    update: UpdateFilter<Case>,
    options?: {
      arrayFilters?: Document[]
    }
  ): Promise<UpdateResult<Case>> {
    return internalMongoUpdateMany(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      filter,
      update,
      options
    )
  }

  public getNonClosedManualCasesCursor(): AggregationCursor<Case> {
    return this.mongoDb
      .db()
      .collection<Case>(CASES_COLLECTION(this.tenantId))
      .aggregate([
        {
          $match: {
            $and: [
              {
                caseType: { $eq: 'MANUAL' },
              },
              { caseStatus: { $exists: true } },
              {
                caseStatus: { $ne: 'CLOSED' },
              },
            ],
          },
        },
      ])
  }

  private async updateOneCase(
    filter: Filter<Case>,
    update: UpdateFilter<Case>,
    options?: {
      arrayFilters?: Document[]
      returnFullDocument?: boolean
    }
  ): Promise<ModifyResult<Case>> {
    return internalMongoUpdateOne(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      filter,
      update,
      options
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
          { caseStatus: { $in: assignmentsStatus } },
          isUnassignedIncluded
            ? {
                $or: [
                  {
                    [`${key}.assigneeUserId`]: {
                      $in: filterAssignmentsIds,
                    },
                  },
                  {
                    $or: [
                      { [key]: { $size: 0 } },
                      { [key]: { $exists: false } },
                    ],
                  },
                ],
              }
            : {
                [`${key}.assigneeUserId`]: {
                  $in: filterAssignmentsIds,
                },
              },
        ],
      },
    ]
  }

  private getAssignmentsStatus = (
    key: 'reviewAssignments' | 'assignments'
  ): CaseStatus[] => {
    const reviewAssignmentsStatus = CASE_STATUSS.filter((status) =>
      shouldUseReviewAssignments(status)
    )
    const assignmentsStatus = difference(CASE_STATUSS, reviewAssignmentsStatus)

    return key === 'assignments' ? assignmentsStatus : reviewAssignmentsStatus
  }

  public async getCasesConditions(
    params: OptionalPagination<DefaultApiGetCaseListRequest>,
    assignments = true
  ): Promise<Filter<Case>[]> {
    const conditions: Filter<Case>[] = []

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
      params.filterAssignmentsIds.length > 0 &&
      assignments
    ) {
      conditions.push({
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

    if (params.afterTimestamp != null || params.beforeTimestamp != null) {
      conditions.push({
        createdTimestamp: {
          $gte: params.afterTimestamp || 0,
          $lte: params.beforeTimestamp || Number.MAX_SAFE_INTEGER,
        },
      })
    }

    if (params.filterCaseClosureReasons) {
      conditions.push({
        'lastStatusChange.reason': { $all: params.filterCaseClosureReasons },
      })
    }

    if (
      params.filterCasesByLastUpdatedEndTimestamp != null &&
      params.filterCasesByLastUpdatedStartTimestamp != null
    ) {
      conditions.push({
        updatedAt: {
          $lte: params.filterCasesByLastUpdatedEndTimestamp,
          $gte: params.filterCasesByLastUpdatedStartTimestamp,
        },
      })
    }

    if (params.filterId != null) {
      conditions.push({ caseId: prefixRegexMatchFilter(params.filterId) })
    }
    if (params.filterIdExact != null) {
      conditions.push({ caseId: params.filterIdExact })
    }

    if (
      params.filterOutCaseStatus != null &&
      params.filterOutCaseStatus.length > 0
    ) {
      conditions.push({
        caseStatus: { $nin: params.filterOutCaseStatus },
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

    if (params.filterRiskLevel != null && hasFeature('RISK_LEVELS')) {
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

    if (params.filterCaseStatus != null && params.filterCaseStatus.length > 0) {
      conditions.push({ caseStatus: { $in: params.filterCaseStatus } })
    }

    if (params.filterCaseTypes != null) {
      conditions.push({ caseType: { $in: params.filterCaseTypes } })
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

    if (params.filterTransactionIds != null) {
      conditions.push({
        caseTransactionsIds: { $in: params.filterTransactionIds },
      })
    }

    if (params.filterRulesHit != null) {
      conditions.push({
        'alerts.ruleInstanceId': { $in: params.filterRulesHit },
      })
    }

    if (params.filterRuleQueueIds != null) {
      conditions.push(getRuleQueueFilter(params.filterRuleQueueIds))
    }

    if (params.filterOriginPaymentMethods != null) {
      conditions.push({
        'caseAggregates.originPaymentMethods': {
          $in: params.filterOriginPaymentMethods,
        },
      })
    }

    if (params.filterDestinationPaymentMethods != null) {
      conditions.push({
        'caseAggregates.destinationPaymentMethods': {
          $in: params.filterDestinationPaymentMethods,
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
        'caseAggregates.tags': {
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

    if (params.filterAlertPriority != null) {
      conditions.push({
        'alerts.priority': {
          $in: params.filterAlertPriority,
        },
      })
    }

    if (params.filterRuleNature && params.filterRuleNature.length > 0) {
      conditions.push({
        'alerts.ruleNature': {
          $in: params.filterRuleNature,
        },
      })
    }

    conditions.push({
      $or: [
        {
          // Need to compare to null, because mongo sometimes replaces undefined with null when saves objects
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          availableAfterTimestamp: { $eq: null },
        },
        {
          availableAfterTimestamp: { $lt: Date.now() },
        },
      ],
    })

    if (params.filterSlaPolicyId?.length) {
      conditions.push({
        slaPolicyDetails: {
          $elemMatch: {
            slaPolicyId: { $in: params.filterSlaPolicyId },
          },
        },
      })
    }

    if (params.filterSlaPolicyStatus?.length) {
      conditions.push({
        slaPolicyDetails: {
          $elemMatch: {
            policyStatus: { $in: params.filterSlaPolicyStatus },
          },
        },
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

    const filter = conditions.length > 0 ? { $and: conditions } : {}

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
          lookupPipelineStage({
            from: ACCOUNTS_COLLECTION(this.tenantId),
            localField: 'assignments.assigneeUserId',
            foreignField: 'id',
            as: '_assignments',
          }),
          {
            $set: {
              _assignmentName: { $toLower: { $first: '$_assignments.name' } },
              _assignments: false,
            },
          },
        ]
      )
    }

    preLimitPipeline.push({ $sort: { [sortField]: sortOrder, _id: 1 } })
    // project should always be the last stage
    postLimitPipeline.push({
      $project: {
        _id: 1,
        assignments: 1,
        updatedAt: 1,
        reviewAssignments: 1,
        caseId: 1,
        caseStatus: 1,
        createdTimestamp: 1,
        priority: 1,
        caseUsers: 1,
        caseTransactionsCount: 1,
        lastStatusChange: 1,
        statusChanges: 1,
        comments: 1,
        falsePositiveDetails: 1,
        alerts: 1,
        caseType: 1,
        caseHierarchyDetails: 1,
        slaPolicyDetails: 1,
        ...(options.includeCaseTransactionIds
          ? { caseTransactionsIds: 1 }
          : {}),
      },
    })

    if (options.hideOptionalData) {
      postLimitPipeline.push({
        $project: {
          'alerts.transactionIds': 0,
          'alerts.ruleChecklist': 0,
          'caseUsers.origin.executedRules': 0,
          'caseUsers.destination.executedRules': 0,
          'caseUsers.origin.hitRules': 0,
          'caseUsers.destination.hitRules': 0,
          'caseUsers.origin.comments': 0,
          'caseUsers.destination.comments': 0,
          'caseUsers.origin.drsScore': 0,
          'caseUsers.destination.drsScore': 0,
          'caseUsers.origin.krsScore': 0,
          'caseUsers.destination.krsScore': 0,
          caseAggregates: 0,
        },
      })
    }

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
    return collection.aggregate<Case>(pipeline, { allowDiskUse: true })
  }

  public async getCasesCount(
    params: DefaultApiGetCaseListRequest
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const conditions = await this.getCasesConditions(params)
    const count = await collection.countDocuments(
      conditions.length > 0 ? { $and: conditions } : {},
      { limit: COUNT_QUERY_LIMIT }
    )
    return count
  }

  public async getUserCountByRuleInstance(
    ruleInstanceId: string,
    filters?: TimeRange
  ): Promise<number> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const count = collection.aggregate([
      {
        $match: {
          'alerts.ruleInstanceId': ruleInstanceId,
          'alerts.createdTimestamp': {
            $gte: filters?.afterTimestamp ?? 0,
            $lte: filters?.beforeTimestamp ?? Number.MAX_SAFE_INTEGER,
          },
        },
      },
      {
        $group: {
          _id: {
            $ifNull: [
              '$caseUsers.origin.userId',
              '$caseUsers.destination.userId',
            ],
          },
        },
      },
      {
        $count: 'count',
      },
    ])

    return count.next().then((result) => result?.count ?? 0)
  }

  public async getFalsePositiveUserIdsByRuleInstance(
    ruleInstanceId: string
  ): Promise<string[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const count = await collection
      .aggregate([
        {
          $match: {
            'alerts.ruleInstanceId': ruleInstanceId,
            caseStatus: 'CLOSED',
            'lastStatusChange.reason': 'False positive',
          },
        },
        {
          $group: {
            _id: {
              $ifNull: [
                '$caseUsers.origin.userId',
                '$caseUsers.destination.userId',
              ],
            },
          },
        },
      ])
      .toArray()

    return [...new Set(count.map((item) => item._id))]
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest,
    options: CaseListOptions = {}
  ): Promise<{ total: number; data: Case[] }> {
    let cursor = await this.getCasesCursor(params, options)
    const total = this.getCasesCount(params)

    if (hasFeature('RISK_LEVELS')) {
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

  public getUpdatePipeline(
    statusChange: CaseStatusChange,
    isLastInReview?: boolean
  ): {
    updatePipeline: UpdateFilter<Case>
  } {
    if (!statusChange.caseStatus) {
      throw new Error('Case status is required')
    }

    const statusChangePipline = {
      ...statusChange,
      userId: isLastInReview ? '$lastStatusChange.userId' : statusChange.userId,
      reviewerId: !isLastInReview ? undefined : statusChange.userId,
    }

    const updatePipeline: UpdateFilter<Case> = [
      {
        $set: {
          caseStatus: statusChange?.caseStatus,
          lastStatusChange: statusChangePipline,
          updatedAt: Date.now(),
          statusChanges: {
            $concatArrays: [
              { $ifNull: ['$statusChanges', []] },
              [statusChangePipline],
            ],
          },
        },
      },
    ]

    return { updatePipeline }
  }

  public async updateStatusOfCases(
    caseIds: string[],
    statusChange: CaseStatusChange,
    isLastInReview?: boolean
  ) {
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      this.getUpdatePipeline(statusChange, isLastInReview).updatePipeline
    )
  }

  public async updateAssignments(
    caseIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      { $set: { assignments, updatedAt: Date.now() } }
    )
  }

  public async updateReviewAssignmentsOfCases(
    caseIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      { $set: { reviewAssignments, updatedAt: Date.now() } }
    )
  }

  public async updateInReviewAssignmentsOfCases(
    caseIds: string[],
    assignments: Assignment[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      { $set: { reviewAssignments, assignments } }
    )
  }

  public async reassignCases(
    assignmentId: string,
    reassignmentId: string
  ): Promise<void> {
    const user = getContext()?.user as Account
    const assignmentsObject: Assignment[] = [
      {
        assignedByUserId: user.id,
        assigneeUserId: reassignmentId,
        timestamp: Date.now(),
      },
    ]

    const keys = ['assignments', 'reviewAssignments'] as (keyof Case)[]

    const pullPromises = keys.map((field) =>
      this.updateManyCases(
        {
          [`${field}.assigneeUserId`]: assignmentId,
          [`${field}.1`]: { $exists: true },
        },
        { $pull: { [field]: { assigneeUserId: assignmentId } } }
      )
    )

    const promises = keys.map((field) =>
      this.updateManyCases(
        {
          [`${field}.assigneeUserId`]: assignmentId,
          [field]: { $size: 1 },
        },
        { $set: { [field]: assignmentsObject } }
      )
    )

    await Promise.all([...promises, ...pullPromises])
  }

  public async updateReviewAssignmentsToAssignments(
    caseIds: string[]
  ): Promise<void> {
    await this.updateManyCases({ caseId: { $in: caseIds } }, [
      {
        $set: {
          assignments: '$reviewAssignments',
          updatedAt: Date.now(),
        },
      },
    ])
  }

  public async saveComment(caseId: string, comment: Comment): Promise<Comment> {
    const commentToSave: Comment = {
      ...comment,
      id: comment.id || uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await this.updateOneCase({ caseId }, [
      {
        $set: {
          comments: {
            $ifNull: [
              { $concatArrays: ['$comments', [commentToSave]] },
              [commentToSave],
            ],
          },
          updatedAt: Date.now(),
        },
      },
    ])
    return commentToSave
  }

  public async saveCasesComment(
    caseIds: string[],
    comment: Comment
  ): Promise<Comment> {
    const commentToSave: Comment = {
      ...comment,
      id: comment.id || uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.updateManyCases(
      {
        caseId: { $in: caseIds },
      },
      [
        {
          $set: {
            comments: {
              $ifNull: [
                { $concatArrays: ['$comments', [commentToSave]] },
                [commentToSave],
              ],
            },
            updatedAt: Date.now(),
          },
        },
      ]
    )

    return commentToSave
  }

  public async deleteCaseComment(caseId: string, commentId: string) {
    await this.updateOneCase(
      { caseId },
      {
        $set: {
          'comments.$[comment].deletedAt': Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        arrayFilters: [
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

  public async getCaseById(
    caseId: string,
    getAggregates = false
  ): Promise<CaseWithoutCaseTransactions | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await collection.findOne<Case>(
      { caseId },
      !getAggregates ? { projection: { caseAggregates: 0 } } : undefined
    )
  }

  public updateAISummary(
    caseId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ) {
    return this.updateOneCase(
      { caseId, 'comments.id': commentId },
      {
        $set: {
          'comments.$[comment].files.$[file].aiSummary': summary,
          updatedAt: Date.now(),
        },
      },
      {
        arrayFilters: [
          { 'comment.id': commentId },
          { 'file.s3Key': fileS3Key },
        ],
      }
    )
  }

  public async getCaseByAlertId(
    alertId: string
  ): Promise<CaseWithoutCaseTransactions | null> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await collection.findOne<Case>({ 'alerts.alertId': alertId })
  }

  public async getCasesByAlertIds(
    alertIds: string[]
  ): Promise<CaseWithoutCaseTransactions[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const cases = await collection
      .find({ 'alerts.alertId': { $in: alertIds } })
      .toArray()

    return cases
  }

  public async getCasesByPaymentDetails(
    paymentDetails: PaymentDetails,
    params: SubjectCasesQueryParams
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const filters: Filter<Case>[] = []

    if (params.filterAvailableAfterTimestamp != null) {
      filters.push({
        availableAfterTimestamp: { $in: params.filterAvailableAfterTimestamp },
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

    if (params.filterCaseType != null) {
      filters.push({
        caseType: params.filterCaseType,
      })
    }

    const { directions } = params
    const paymentDetailsFilters = omitBy(
      {
        method: paymentDetails.method,
        ...getPaymentDetailsIdentifiers(paymentDetails),
      },
      isNil
    )
    const directionsFilters: Filter<Case>[] = []
    for (const direction of directions ?? ['ORIGIN', 'DESTINATION']) {
      const directionFilters: Filter<Case>[] = []
      for (const [key, value] of Object.entries(paymentDetailsFilters)) {
        const directionKey = direction === 'ORIGIN' ? 'origin' : 'destination'
        directionFilters.push({
          [`paymentDetails.${directionKey}.${key}`]: value,
        })
      }
      directionsFilters.push({ $and: directionFilters })
    }
    if (directionsFilters.length > 0) {
      filters.push({
        $or: directionsFilters,
      })
    }
    if (params.filterTransactionId) {
      filters.push({
        caseTransactionsIds: params.filterTransactionId,
      })
    }

    const filter = {
      ...(filters.length > 0 ? { $and: filters } : {}),
    }
    return await casesCollection.find(filter).toArray()
  }

  public async getCasesByUserId(
    userId: string,
    params: SubjectCasesQueryParams
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const filters: Filter<Case>[] = []

    if (params.filterAvailableAfterTimestamp != null) {
      filters.push({
        availableAfterTimestamp: { $in: params.filterAvailableAfterTimestamp },
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

    if (params.filterCaseType != null) {
      filters.push({
        caseType: params.filterCaseType,
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

    if (params.filterTransactionId) {
      filters.push({
        caseTransactionsIds: params.filterTransactionId,
      })
    }

    return await casesCollection
      .find({
        ...(filters.length > 0 ? { $and: filters } : {}),
      })
      .toArray()
  }

  public async getCasesByTransactionIds(
    transactionIds: string[],
    additionalFilters?: Filter<Case>
  ): Promise<Case[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection
      .find({
        caseTransactionsIds: { $in: transactionIds },
        ...additionalFilters,
      })
      .toArray()
  }

  public async getCasesByIds(
    caseIds: string[]
  ): Promise<Array<CaseWithoutCaseTransactions>> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection.find({ caseId: { $in: caseIds } }).toArray()
  }

  public async markAllChecklistItemsAsDone(caseIds: string[]) {
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      { $set: { 'alerts.$[alert].ruleChecklist.$[item].done': 'DONE' } },
      {
        arrayFilters: [
          {
            'alert.ruleChecklist.done': { $ne: 'DONE' },
            'alert.ruleChecklist': { $exists: true, $ne: null },
          },
          { 'item.done': { $ne: 'DONE' }, item: { $exists: true } },
        ],
      }
    )
  }

  public async updateDynamicRiskScores(
    transactionId: string,
    originDrsScore: number | undefined | null,
    destinationDrsScore: number | undefined | null
  ) {
    await Promise.all([
      originDrsScore != null &&
        this.updateOneCase(
          {
            caseTransactionsIds: transactionId,
            'caseUsers.origin': { $ne: null },
          },
          {
            $set: {
              'caseUsers.originUserDrsScore': originDrsScore,
            },
          }
        ),
      destinationDrsScore != null &&
        this.updateOneCase(
          {
            caseTransactionsIds: transactionId,
            'caseUsers.destination': { $ne: null },
          },
          {
            $set: {
              'caseUsers.destinationUserDrsScore': destinationDrsScore,
            },
          }
        ),
    ])
  }

  public async addExternalCaseMongo(
    caseEntity: Case
  ): Promise<CaseWithoutCaseTransactions> {
    await internalMongoInsert(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      caseEntity
    )
    return caseEntity
  }

  public async updateCase(caseEntity: Partial<Case>): Promise<Case | null> {
    const updatedCase = await this.updateOneCase(
      { caseId: caseEntity.caseId },
      {
        $set: {
          ...caseEntity,
          updatedAt: Date.now(),
        },
      },
      { returnFullDocument: true }
    )

    return updatedCase.value
  }

  public async syncCaseUsers(newUser: InternalUser): Promise<void> {
    await Promise.all([
      this.updateManyCases(
        { 'caseUsers.origin.userId': newUser.userId },
        { $set: { 'caseUsers.origin': newUser } }
      ),
      this.updateManyCases(
        { 'caseUsers.destination.userId': newUser.userId },
        { $set: { 'caseUsers.destination': newUser } }
      ),
    ])
  }
}
