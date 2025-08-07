import { v4 as uuidv4 } from 'uuid'
import {
  AggregationCursor,
  Document,
  Filter,
  ModifyResult,
  MongoClient,
  UpdateFilter,
  UpdateResult,
  ObjectId,
} from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { intersection, isEmpty, isNil, omitBy } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk'
import { SlaUpdates } from '../sla/sla-service'
import { DynamoCaseRepository } from './dynamo-repository'
import { LinkerService } from '@/services/linker'
import { CaseClickhouseRepository } from '@/services/cases/clickhouse-repository'
import {
  internalMongoReplace,
  paginatePipeline,
  prefixRegexMatchFilter,
  internalMongoUpdateMany,
  internalMongoUpdateOne,
  withTransaction,
  internalMongoBulkUpdate,
} from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Priority } from '@/@types/openapi-internal/Priority'
import { Tag } from '@/@types/openapi-public/Tag'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { COUNT_QUERY_LIMIT, OptionalPagination } from '@/utils/pagination'
import { PRIORITYS } from '@/@types/openapi-internal-custom/Priority'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { traceable } from '@/core/xray'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentDetailsIdentifiers } from '@/core/dynamodb/dynamodb-keys'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Account } from '@/@types/openapi-internal/Account'
import { CounterRepository } from '@/services/counter/repository'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { AccountsService } from '@/services/accounts'
import { TableListViewEnum } from '@/@types/openapi-internal/TableListViewEnum'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import {
  getClickhouseClient,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/utils'
import { getAssignmentsStatus } from '@/services/case-alerts-common/utils'
import { CommentsResponseItem } from '@/@types/openapi-internal/CommentsResponseItem'
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
  includeAlertTransactionIds?: boolean
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
  dynamoCaseRepository: DynamoCaseRepository
  clickhouseCaseRepository?: CaseClickhouseRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb as DynamoDBDocumentClient
    this.dynamoCaseRepository = new DynamoCaseRepository(
      tenantId,
      this.dynamoDb
    )
  }
  /**
   * Get the clickhouse case repository.
   * Since we cannot initialize the repository in the constructor, we need to initialize it here.
   * If the repository is already initialized, it will return the existing repository.\
   * Otherwise, it will initialize a new repository and return it.
   *
   * @returns The clickhouse case repository
   */
  private async getClickhouseCaseRepository(): Promise<CaseClickhouseRepository> {
    if (this.clickhouseCaseRepository) {
      return this.clickhouseCaseRepository
    }
    const clickhouseClient = await getClickhouseClient(this.tenantId)
    this.clickhouseCaseRepository = new CaseClickhouseRepository(
      this.tenantId,
      {
        clickhouseClient,
        dynamoDb: this.dynamoDb,
      }
    )
    return this.clickhouseCaseRepository
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

  public async getCasesByAssigneeId(assigneeId: string): Promise<Case[]> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseCaseRepository = await this.getClickhouseCaseRepository()
      const caseIds = await clickhouseCaseRepository.getCaseIdsByAssigneeId(
        assigneeId
      )
      return this.dynamoCaseRepository.getCasesFromCaseIds(caseIds)
    }
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return casesCollection
      .find({
        'assignments.assigneeUserId': assigneeId,
        caseStatus: {
          $nin: ['CLOSED', 'REJECTED', 'ARCHIVED'] as CaseStatus[], // end game statuses
        },
      })
      .toArray()
  }

  public async getCaseIdsByUserId(
    userId: string,
    params?: {
      caseType?: CaseType
    }
  ): Promise<{ caseId?: string }[]> {
    if (isClickhouseMigrationEnabled()) {
      return this.dynamoCaseRepository.getCaseIdsByUserId(userId, params)
    }
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
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateManualCase(
        caseId,
        transactions,
        comment,
        transactionsCount
      )
    }
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
    const counterRepository = new CounterRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.dynamoDb,
    })

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
      const caseToSave = { ...caseEntity } as any

      // Check if _id exists and is a string
      if (caseToSave._id && typeof caseToSave._id === 'string') {
        caseToSave._id = new ObjectId(caseToSave._id)
      }

      await internalMongoReplace(
        this.mongoDb,
        casesCollectionName,
        { caseId: caseEntity.caseId },
        caseToSave
      )
    })
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.addCase(caseEntity)
    }

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

  //TODO: add in the caller function; but unsure about the implementation
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
      upsert?: boolean
    }
  ): Promise<ModifyResult<Case>> {
    return internalMongoUpdateOne(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      filter,
      update,
      {
        ...options,
      }
    )
  }

  private getAssignmentFilter = (
    key: 'reviewAssignments' | 'assignments',
    filterAssignmentsIds: string[]
  ): Document[] => {
    const isUnassignedIncluded = filterAssignmentsIds.includes('Unassigned')
    const assignmentsStatus = getAssignmentsStatus(key, 'case')
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

  public async getCasesConditions(
    params: OptionalPagination<DefaultApiGetCaseListRequest>,
    assignments = true
  ): Promise<Filter<Case>[]> {
    const conditions: Filter<Case>[] = []

    if (params.filterAssignmentsRoles?.length) {
      // Since the number of accounts is typically a small number, we can fetch relevant accounts and filter cases by
      // making use of the `params.filterAssignmentsIds` field.
      const accountsService = AccountsService.getInstance(this.dynamoDb, true)
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

    if (params.filterUserId != null || params.filterUserIds != null) {
      const userIds: string[] = []

      if (params.filterUserId != null) {
        userIds.push(params.filterUserId)
      }

      if (params.filterUserIds != null) {
        userIds.push(...params.filterUserIds)
      }

      conditions.push({
        $or: [
          { 'caseUsers.origin.userId': { $in: userIds } },
          { 'caseUsers.destination.userId': { $in: userIds } },
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

    if (params.filterCaseSlaPolicyId?.length) {
      conditions.push({
        slaPolicyDetails: {
          $elemMatch: {
            $and: [
              {
                slaPolicyId: { $in: params.filterCaseSlaPolicyId },
              },
              {
                policyStatus: { $exists: true },
              },
            ],
          },
        },
      })
    }

    if (params.filterCaseSlaPolicyStatus?.length) {
      conditions.push({
        slaPolicyDetails: {
          $elemMatch: {
            policyStatus: { $in: params.filterCaseSlaPolicyStatus },
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
        caseUsers: {
          origin: {
            userId: 1,
            userDetails: {
              name: 1,
            },
            type: 1,
            userStateDetails: {
              state: 1,
            },
            kycStatusDetails: 1,
            legalEntity: 1,
            tags: 1,
            sanctionsStatus: 1,
            pepStatus: 1,
            adverseMediaStatus: 1,
          },
          destination: {
            userId: 1,
            userDetails: {
              name: 1,
            },
            type: 1,
            userStateDetails: {
              state: 1,
            },
            kycStatusDetails: 1,
            legalEntity: 1,
            tags: 1,
            sanctionsStatus: 1,
            pepStatus: 1,
            adverseMediaStatus: 1,
          },
          originUserDrsScore: 1,
          destinationUserDrsScore: 1,
          originUserRiskLevel: 1,
          destinationUserRiskLevel: 1,
        },
        caseTransactionsCount: 1,
        lastStatusChange: 1,
        statusChanges: 1,
        alerts: {
          ...(options.includeAlertTransactionIds
            ? { transactionIds: 1, alertId: 1, comments: 1 }
            : { comments: 1, alertId: 1 }),
        },
        caseType: 1,
        comments: params.view === ('TABLE' as TableListViewEnum) ? [] : 1,
        slaPolicyDetails:
          params.view === ('TABLE' as TableListViewEnum)
            ? {
                policyStatus: 1,
                elapsedTime: 1,
              }
            : [],
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

  public async getFalsePositiveUserIdsByRuleInstance(
    ruleInstanceId: string
  ): Promise<string[]> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseCaseRepository = await this.getClickhouseCaseRepository()
      return clickhouseCaseRepository.getFalsePositiveUserIdsByRuleInstance(
        ruleInstanceId
      )
    }
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

  public async getAllUsersCountByRuleInstance(
    ruleInstanceId: string
  ): Promise<number> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseCaseRepository = await this.getClickhouseCaseRepository()
      return clickhouseCaseRepository.getAllUsersCountByRuleInstance(
        ruleInstanceId
      )
    }
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const count = collection.aggregate([
      { $match: { 'alerts.ruleInstanceId': ruleInstanceId } },
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

  public async getCasesTransactions(caseId: string): Promise<string[]> {
    if (isClickhouseMigrationEnabled()) {
      return this.dynamoCaseRepository.getCasesTransactions(caseId)
    }
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const caseItem = await collection.findOne(
      { caseId },
      { projection: { alerts: { transactionIds: 1 } } }
    )
    if (!caseItem || !caseItem.alerts) {
      return []
    }
    return [
      ...new Set(
        caseItem.alerts.flatMap((alert) => alert.transactionIds ?? [])
      ),
    ]
  }

  public async getUserTransaction(userId: string) {
    if (isClickhouseMigrationEnabled()) {
      return this.dynamoCaseRepository.getUserTransaction(userId)
    }
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const caseItem = await collection.find(
      {
        $or: [
          { 'caseUsers.origin.userId': userId },
          { 'caseUsers.destination.userId': userId },
        ],
      },
      {
        projection: {
          alerts: { alertId: 1, transactionIds: 1 },
          caseUsers: 1,
          caseId: 1,
        },
      }
    )
    if (!caseItem) {
      return []
    }
    return [
      ...new Set(
        (await caseItem.toArray()).flatMap(
          (caseDoc) =>
            caseDoc.alerts?.flatMap((alert) => alert.transactionIds ?? []) ?? []
        )
      ),
    ]
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest,
    options: CaseListOptions = {}
  ): Promise<{ total: number; data: Case[] }> {
    if (params.filterParentUserId) {
      const linker = new LinkerService(this.tenantId)
      const userIds = await linker.getLinkedChildUsers(
        params.filterParentUserId
      )
      params.filterUserIds = userIds
    }
    if (isClickhouseMigrationEnabled()) {
      const clickhouseCaseRepository = await this.getClickhouseCaseRepository()
      const data = await clickhouseCaseRepository.getCases(params)
      const cases = await this.dynamoCaseRepository.getCasesFromCaseIds(
        data.items
      )
      return { total: data.total, data: cases }
    }
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
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateStatus(
        caseIds,
        statusChange,
        isLastInReview
      )
    }
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      this.getUpdatePipeline(statusChange, isLastInReview).updatePipeline
    )
  }

  public async updateAssignments(
    caseIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateAssignmentsReviewAssignments(
        caseIds,
        assignments
      )
    }
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      { $set: { assignments, updatedAt: Date.now() } }
    )
  }

  public async updateReviewAssignmentsOfCases(
    caseIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateAssignmentsReviewAssignments(
        caseIds,
        undefined,
        reviewAssignments
      )
    }
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
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateAssignmentsReviewAssignments(
        caseIds,
        assignments,
        reviewAssignments
      )
    }
    await this.updateManyCases(
      { caseId: { $in: caseIds } },
      { $set: { reviewAssignments, assignments } }
    )
  }

  public async reassignCases(
    assignmentId: string,
    reassignmentId: string
  ): Promise<void> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseCaseRepository = await this.getClickhouseCaseRepository()
      const caseIds = await clickhouseCaseRepository.getCaseIdsForReassignment(
        assignmentId
      )
      await this.dynamoCaseRepository.reassignCases(
        assignmentId,
        reassignmentId,
        caseIds
      )
    }
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
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateReviewAssignmentsToAssignments(
        caseIds
      )
    }
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
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.saveComments(caseId, [commentToSave])
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
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.saveCasesComment(caseIds, comment)
    }
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
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.deleteCaseComment(caseId, commentId)
    }
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
    getCaseAggregates = false
  ): Promise<CaseWithoutCaseTransactions | null> {
    if (isClickhouseMigrationEnabled()) {
      const caseFromDynamo =
        await this.dynamoCaseRepository.getCasesFromCaseIds([caseId], true, {
          joinAlerts: true,
          joinComments: true,
          joinFiles: true,
        })
      return caseFromDynamo[0] ?? null
    }
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await collection.findOne<Case>(
      { caseId },
      !getCaseAggregates ? { projection: { caseAggregates: 0 } } : undefined
    )
  }

  public async updateAISummary(
    caseId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ) {
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateAISummary(
        caseId,
        commentId,
        fileS3Key,
        summary
      )
    }
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
    if (isClickhouseMigrationEnabled()) {
      const cases = await this.dynamoCaseRepository.getCasesByAlertIds([
        alertId,
      ])
      return cases[0] ?? null
    }
    const db = this.mongoDb.db()
    const collection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await collection.findOne<Case>({ 'alerts.alertId': alertId })
  }

  public async getCasesByAlertIds(
    alertIds: string[]
  ): Promise<CaseWithoutCaseTransactions[]> {
    if (isClickhouseMigrationEnabled()) {
      return this.dynamoCaseRepository.getCasesByAlertIds(alertIds)
    }
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

  public async getCasesByIds(
    caseIds: string[]
  ): Promise<Array<CaseWithoutCaseTransactions>> {
    if (isClickhouseMigrationEnabled()) {
      return this.dynamoCaseRepository.getCasesFromCaseIds(caseIds, true, {
        joinAlerts: true,
        joinComments: true,
        joinFiles: true,
      })
    }
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    return await casesCollection.find({ caseId: { $in: caseIds } }).toArray()
  }

  // todo this needs to be implemented in the alerts side.
  public async markAllChecklistItemsAsDone(caseIds: string[]) {
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.markAllChecklistItemsAsDone(caseIds)
    }
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
    transaction: Pick<
      TransactionWithRulesResult,
      'transactionId' | 'hitRules' | 'originUserId' | 'destinationUserId'
    >,
    originDrsScore: number | undefined | null,
    destinationDrsScore: number | undefined | null
  ) {
    if (!transaction.hitRules?.length) {
      return
    }
    if (isClickhouseMigrationEnabled()) {
      await Promise.all(
        [
          transaction.originUserId &&
            this.dynamoCaseRepository.updateDynamicRiskScores(
              transaction.originUserId,
              originDrsScore,
              destinationDrsScore,
              'origin'
            ),
          transaction.destinationUserId &&
            this.dynamoCaseRepository.updateDynamicRiskScores(
              transaction.destinationUserId,
              originDrsScore,
              destinationDrsScore,
              'destination'
            ),
        ].filter(Boolean)
      )
    }
    await Promise.all([
      originDrsScore != null &&
        this.updateOneCase(
          {
            caseTransactionsIds: transaction.transactionId,
            'caseUsers.origin': { $ne: null },
          },
          { $set: { 'caseUsers.originUserDrsScore': originDrsScore } },
          { upsert: false }
        ),
      destinationDrsScore != null &&
        this.updateOneCase(
          {
            caseTransactionsIds: transaction.transactionId,
            'caseUsers.destination': { $ne: null },
          },
          {
            $set: { 'caseUsers.destinationUserDrsScore': destinationDrsScore },
          },
          { upsert: false }
        ),
    ])
  }

  public async addExternalCaseMongo(
    caseEntity: Case
  ): Promise<CaseWithoutCaseTransactions> {
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.addCase(caseEntity)
    }
    await internalMongoUpdateOne(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      { caseId: caseEntity.caseId },
      { $set: caseEntity },
      { upsert: true }
    )
    return caseEntity
  }

  public async updateCase(caseEntity: Partial<Case>): Promise<Case | null> {
    if (isClickhouseMigrationEnabled()) {
      if (!caseEntity.caseId) {
        throw new Error('Case ID is required')
      }
      await this.dynamoCaseRepository.saveCases([
        { ...caseEntity, updatedAt: Date.now() } as Case,
      ])
      // Since we are updating the case in mongodb, currently we are not returning the case from dynamo
    }
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

  public async updateCaseSlaPolicyDetails(
    updates: SlaUpdates[]
  ): Promise<void> {
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.updateCaseSlaPolicyDetails(updates)
    }
    const operations = updates.map((update) => ({
      updateOne: {
        filter: { caseId: update.entityId },
        update: { $set: { slaPolicyDetails: update.slaPolicyDetails } },
      },
    }))
    await this.bulkUpdateCases(operations)
  }

  public async bulkUpdateCases(
    operations: {
      updateOne?: {
        filter: Filter<Case>
        update: Document
        arrayFilters?: Document[]
      }
      updateMany?: {
        filter: Filter<Case>
        update: Document
        arrayFilters?: Document[]
      }
    }[]
  ) {
    await internalMongoBulkUpdate(
      this.mongoDb,
      CASES_COLLECTION(this.tenantId),
      operations
    )
  }

  public async syncCaseUsers(newUser: InternalUser): Promise<void> {
    if (isClickhouseMigrationEnabled()) {
      await this.dynamoCaseRepository.syncCaseUsers(newUser)
    }
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

  public async updateCasesDrsScores(
    caseIds: string[],
    drsScore: number
  ): Promise<void> {
    if (caseIds.length === 0) {
      return
    }

    await this.bulkUpdateCases([
      {
        updateMany: {
          filter: { caseId: { $in: caseIds } },
          update: {
            $set: {
              'caseUsers.originUserDrsScore': {
                $cond: {
                  if: { $ne: ['$caseUsers.origin', null] },
                  then: drsScore,
                  else: '$caseUsers.originUserDrsScore',
                },
              },
              'caseUsers.destinationUserDrsScore': {
                $cond: {
                  if: { $eq: ['$caseUsers.origin', null] },
                  then: drsScore,
                  else: '$caseUsers.destinationUserDrsScore',
                },
              },
              updatedAt: Date.now(),
            },
          },
        },
      },
    ])
  }

  public async getComments(caseIds: string[]): Promise<CommentsResponseItem[]> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const caseComments = await casesCollection
      .find({ caseId: { $in: caseIds } })
      .project({
        caseId: 1,
        comments: 1,
      })
      .toArray()

    return caseComments.map((comment) => {
      return {
        comments: comment.comments,
        entityId: comment.caseId,
        entityType: 'CASE',
      }
    })
  }
}
