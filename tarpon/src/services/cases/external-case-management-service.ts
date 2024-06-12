import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError from 'http-errors'
import { isEmpty, omitBy, pick, uniq } from 'lodash'
import { S3 } from '@aws-sdk/client-s3'
import { UserRepository } from '../users/repositories/user-repository'
import { CaseAlertsCommonService, S3Config } from '../case-alerts-common'
import { CasesAlertsTransformer } from './cases-alerts-transformer'
import { CaseRepository } from './repository'
import { CasesAlertsAuditLogService } from './case-alerts-audit-log-service'
import { CaseService } from '.'
import { Case } from '@/@types/openapi-public-management/Case'
import { Case as CaseInternal } from '@/@types/openapi-internal/Case'
import { CaseCreationRequest } from '@/@types/openapi-public-management/CaseCreationRequest'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { CaseUpdateable } from '@/@types/openapi-public-management/CaseUpdateable'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { PaymentEntityDetails } from '@/@types/openapi-public-management/PaymentEntityDetails'
import { traceable } from '@/core/xray'
import { statusEscalated } from '@/utils/helpers'
import { CaseStatusChangeRequest } from '@/@types/openapi-public-management/CaseStatusChangeRequest'
import { DefaultApiGetCasesRequest } from '@/@types/openapi-public-management/RequestParameters'
import { CasesListResponse } from '@/@types/openapi-public-management/CasesListResponse'
import { getStatuses } from '@/utils/case'
import { cursorPaginate, DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Status } from '@/@types/openapi-public-management/Status'
import { Priority } from '@/@types/openapi-public-management/Priority'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'

@traceable
export class ExternalCaseManagementService extends CaseAlertsCommonService {
  private caseRepository: CaseRepository
  private userRepository: UserRepository
  private casesTransformer: CasesAlertsTransformer
  private tenantId: string
  private connections: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBDocumentClient
  }
  private casesAlertsAuditLogService: CasesAlertsAuditLogService

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient },
    s3: S3,
    s3Config: S3Config
  ) {
    super(s3, s3Config)
    this.caseRepository = new CaseRepository(tenantId, connections)
    this.userRepository = new UserRepository(tenantId, connections)
    this.casesTransformer = new CasesAlertsTransformer(tenantId, connections)
    this.tenantId = tenantId
    this.connections = connections
    this.casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      tenantId,
      connections
    )
  }

  private async validateCaseCreationRequest(
    requestBody: CaseCreationRequest
  ): Promise<void> {
    const caseId = requestBody.caseId

    if (!caseId) {
      throw new createHttpError.BadRequest(
        `Case id missing in payload. Please provide a case id`
      )
    }

    const case_ = await this.caseRepository.getCaseById(caseId)
    // Ignore cases which are C-{number} as they are internal cases
    const caseIdRegex = /^C-\d+$/

    if (caseIdRegex.test(caseId)) {
      throw new createHttpError.BadRequest(
        `Case id: ${caseId} not allowed for creation reserving C-{number} for internal cases`
      )
    }
    if (case_) {
      throw new createHttpError.Conflict(
        `Case with id: ${caseId} already exists. Please provide a case id which does not exist`
      )
    }

    if (requestBody?.caseId) {
      if (caseId.length > 40) {
        throw new createHttpError.BadRequest(
          `Case id: ${caseId} is too long. We only support case ids upto 40 characters`
        )
      }
    }

    if (!isEmpty(requestBody.relatedCases)) {
      const relatedCaseIds = uniq(requestBody.relatedCases)

      const cases = await this.caseRepository.getCasesByIds(relatedCaseIds)

      if (cases.length !== relatedCaseIds.length) {
        const caseIdsNotFound = relatedCaseIds.filter(
          (caseId) => !cases.find((c) => c.caseId === caseId)
        )

        throw new createHttpError.BadRequest(
          `Related cases not found: ${caseIdsNotFound.join(
            ', '
          )}. Please provide case ids which are already created`
        )
      }
    }
  }

  private async getCaseUser(userId: string): Promise<InternalUser> {
    const user = await this.userRepository.getUserById(userId)

    if (!user) {
      throw new createHttpError.BadRequest(`
        User with id: ${userId} not found. Please provide a user id which is already created using FRAML API
      `)
    }

    return user
  }

  private async transformCreationRequestToInternalCase(
    requestBody: CaseCreationRequest
  ): Promise<CaseInternal> {
    const assignments: CaseInternal['assignments'] =
      await this.casesTransformer.transformAssignmentsToInternal(
        requestBody.assignments || []
      )

    const user =
      requestBody.entityDetails.type === 'USER'
        ? await this.getCaseUser(requestBody.entityDetails.userId)
        : undefined

    const case_: CaseInternal = {
      caseId: requestBody.caseId,
      createdTimestamp: requestBody.createdTimestamp || Date.now(),
      createdTimestampInternal: Date.now(),
      updatedAt: Date.now(),
      caseAggregates: {
        originPaymentMethods: [],
        destinationPaymentMethods: [],
        tags: [],
      },
      tags: requestBody.tags || [],
      caseType: 'EXTERNAL',
      alerts: [],
      assignments,
      caseStatus: 'OPEN',
      creationReason: requestBody.creationReason,
      ...(requestBody.entityDetails.type === 'PAYMENT' && {
        paymentDetails: { origin: requestBody.entityDetails.paymentDetails },
      }),
      ...(requestBody.entityDetails.type === 'USER' &&
        user && { caseUsers: { origin: user } }),
      caseTransactionsIds: [],
      latestTransactionArrivalTimestamp: 0,
      priority: requestBody.priority,
      subjectType: requestBody.entityDetails.type,
    }

    return case_
  }

  private getEnitityDetails(internalCase: CaseInternal): Case['entityDetails'] {
    return internalCase.subjectType === 'PAYMENT' && internalCase.paymentDetails
      ? {
          type: 'PAYMENT',
          paymentDetails: internalCase?.paymentDetails.origin?.method
            ? (internalCase.paymentDetails
                ?.origin as PaymentEntityDetails['paymentDetails'])
            : (internalCase.paymentDetails
                ?.destination as PaymentEntityDetails['paymentDetails']),
        }
      : {
          type: 'USER',
          userId: (internalCase.caseUsers?.origin?.userId ||
            internalCase.caseUsers?.destination?.userId) as string,
        }
  }

  private async transformInternalCaseToExternalCase(
    internalCase: CaseInternal
  ): Promise<Case> {
    const caseStatus = internalCase.caseStatus

    const externalCaseStatus = this.casesTransformer.getExternalCaseStatus(
      caseStatus as CaseStatus
    )

    return {
      caseId: internalCase.caseId as string,
      entityDetails: this.getEnitityDetails(internalCase),
      caseStatus: externalCaseStatus,
      priority: internalCase.priority || 'P1',
      createdTimestamp: internalCase.createdTimestamp || Date.now(),
      updatedAt: internalCase.updatedAt || Date.now(),
      relatedCases: internalCase.relatedCases,
      tags: internalCase.tags,
      assignments:
        await this.casesTransformer.transformAssignmentsToExternalCase(
          internalCase.caseStatus as CaseStatus,
          internalCase
        ),
      creationReason: internalCase.creationReason,
    }
  }

  public async getCaseById(caseId: string): Promise<Case> {
    const case_ = await this.caseRepository.getCaseById(caseId)

    if (!case_) {
      throw new createHttpError.NotFound('Case not found')
    }

    return await this.transformInternalCaseToExternalCase(case_)
  }

  public async createCase(requestBody: CaseCreationRequest): Promise<Case> {
    await this.validateCaseCreationRequest(requestBody)
    const case_ = await this.transformCreationRequestToInternalCase(requestBody)

    const createdCase = await this.caseRepository.addExternalCaseMongo(case_)
    await this.casesAlertsAuditLogService.handleAuditLogForNewCase(
      case_,
      'API_CREATION'
    )
    return await this.transformInternalCaseToExternalCase(createdCase)
  }

  public async updateCase(
    caseId: string,
    casePatchRequest: CaseUpdateable
  ): Promise<Case> {
    const internalCase = await this.caseRepository.getCaseById(caseId)

    if (!internalCase) {
      throw new createHttpError.NotFound(
        `Case with id: ${caseId} not found. You can create a new case by calling POST /cases with id: ${caseId}`
      )
    }

    const externalCaseStatus = this.casesTransformer.getExternalCaseStatus(
      internalCase.caseStatus as CaseStatus
    )

    if (
      ['IN_REVIEW', 'IN_PROGRESS', 'ON_HOLD'].includes(externalCaseStatus) &&
      casePatchRequest.assignments
    ) {
      throw new createHttpError.BadRequest(
        `We cannot update assignments for cases in ${externalCaseStatus} status. You can update assignments for cases in OPEN, CLOSED, REOPENED and ESCALATED status`
      )
    }

    const assignments = casePatchRequest.assignments
      ? await this.casesTransformer.transformAssignmentsToInternal(
          casePatchRequest.assignments
        )
      : undefined

    const user =
      casePatchRequest.entityDetails?.type === 'USER'
        ? await this.getCaseUser(casePatchRequest.entityDetails.userId)
        : undefined

    const caseUpdates: Partial<CaseInternal> = omitBy<Partial<CaseInternal>>(
      {
        ...(statusEscalated(internalCase.caseStatus)
          ? { reviewAssignments: assignments }
          : { assignments }),
        priority: casePatchRequest.priority,
        tags: casePatchRequest.tags,
        creationReason: casePatchRequest.creationReason,
        ...(casePatchRequest.entityDetails?.type === 'PAYMENT' && {
          paymentDetails: {
            origin: casePatchRequest.entityDetails.paymentDetails,
          },
        }),
        ...(casePatchRequest.entityDetails?.type === 'USER' && {
          caseUsers: {
            origin: user,
          },
        }),
        relatedCases: casePatchRequest.relatedCases,
      },
      isEmpty
    )

    const updatedCase = await this.caseRepository.updateCase({
      caseId,
      ...caseUpdates,
    })

    if (!updatedCase) {
      throw new createHttpError.NotFound(
        `Case with id: ${caseId} not found. You can create a new case by calling POST /cases with id: ${caseId}`
      )
    }

    const oldImage = pick(internalCase, Object.keys(caseUpdates))

    await this.casesAlertsAuditLogService.handleAuditLogForCaseUpdateViaApi(
      caseId,
      oldImage,
      caseUpdates
    )

    return await this.transformInternalCaseToExternalCase(updatedCase)
  }

  public async updateCaseStatus(
    updateRequest: CaseStatusChangeRequest,
    caseId: string
  ) {
    const internalCase = await this.caseRepository.getCaseById(caseId)
    if (!internalCase) {
      throw new createHttpError.NotFound('Case not found')
    }
    const internalStatus = this.casesTransformer.getInternalCaseStatus(
      updateRequest.status
    )
    if (internalStatus === internalCase.caseStatus) {
      throw new createHttpError.BadRequest(
        'Case status is already ' + updateRequest.status
      )
    }
    if (internalStatus === 'CLOSED' && !updateRequest.reason?.length) {
      throw new createHttpError.BadRequest(
        'Reason is required for closing a case'
      )
    }
    const internalCaseService = new CaseService(
      this.caseRepository,
      this.s3,
      this.s3Config
    )
    const internalStatusChangeRequest: CaseStatusUpdate = {
      caseStatus: internalStatus,
      reason: updateRequest.reason ?? [],
      comment: updateRequest.comment,
      files: updateRequest.files,
      timestamp: Date.now(),
      otherReason: updateRequest.otherReason,
    }
    await internalCaseService.updateStatus(
      [caseId],
      internalStatusChangeRequest,
      {
        externalRequest: true,
        cascadeAlertsUpdate: true,
        skipReview: true,
      }
    )
    return { caseStatus: (await this.getCaseById(caseId)).caseStatus }
  }

  public validateAndTransformGetCasesRequest(
    queryObj: Record<string, string | undefined>
  ): DefaultApiGetCasesRequest {
    if (queryObj.filterAfterCreatedTimestamp) {
      const afterTimestamp = Number(queryObj.filterAfterCreatedTimestamp)

      if (isNaN(afterTimestamp)) {
        throw new createHttpError.BadRequest(
          `Invalid filterAfterCreatedTimestamp: ${queryObj.filterAfterCreatedTimestamp}. Please provide a valid timestamp`
        )
      }
    }

    if (queryObj.filterBeforeCreatedTimestamp) {
      const beforeTimestamp = Number(queryObj.filterBeforeCreatedTimestamp)

      if (isNaN(beforeTimestamp)) {
        throw new createHttpError.BadRequest(
          `Invalid filterBeforeCreatedTimestamp: ${queryObj.filterBeforeCreatedTimestamp}. Please provide a valid timestamp`
        )
      }
    }

    if (queryObj.pageSize) {
      const pageSize = Number(queryObj.pageSize)

      if (isNaN(pageSize)) {
        throw new createHttpError.BadRequest(
          `Invalid pageSize: ${queryObj.pageSize}. Please provide a valid number`
        )
      }

      if (pageSize > 100) {
        throw new createHttpError.BadRequest(
          `Invalid pageSize: ${queryObj.pageSize}. Maximum allowed page size is 100`
        )
      }
    }

    return {
      filterAfterCreatedTimestamp: queryObj.filterAfterCreatedTimestamp
        ? Number(queryObj.filterAfterCreatedTimestamp)
        : undefined,
      filterBeforeCreatedTimestamp: queryObj.filterBeforeCreatedTimestamp
        ? Number(queryObj.filterBeforeCreatedTimestamp)
        : undefined,
      filterCaseStatus: queryObj.filterCaseStatus
        ? (queryObj.filterCaseStatus.split(',') as Status[])
        : undefined,
      filterPriority: queryObj.filterPriority as Priority,
      filterCaseSource: queryObj.filterCaseSource
        ? (queryObj.filterCaseSource.split(',') as CaseType[])
        : undefined,
      pageSize: queryObj.pageSize
        ? Number(queryObj.pageSize)
        : DEFAULT_PAGE_SIZE,
      sortBy: queryObj.sortBy as DefaultApiGetCasesRequest['sortBy'],
      sortOrder: queryObj.sortOrder as DefaultApiGetCasesRequest['sortOrder'],
      start: queryObj.start,
    }
  }

  public async getCases(
    query: DefaultApiGetCasesRequest
  ): Promise<CasesListResponse> {
    const casesCondition = await this.caseRepository.getCasesConditions({
      filterCaseStatus: getStatuses(query.filterCaseStatus),
      pageSize: query.pageSize,
      afterTimestamp: query.filterAfterCreatedTimestamp,
      beforeTimestamp: query.filterBeforeCreatedTimestamp,
      filterPriority: query.filterPriority,
      filterCaseTypes: query.filterCaseSource,
    })

    const db = this.connections.mongoDb.db()

    const data = await cursorPaginate<CaseInternal>(
      db.collection(CASES_COLLECTION(this.tenantId)),
      { $and: casesCondition },
      {
        pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
        fromCursorKey: query.start,
        sortField: query.sortBy || 'createdTimestamp',
        sortOrder: query.sortOrder === 'asc' ? 'ascend' : 'descend',
      }
    )

    const casesItems = await Promise.all(
      data.items.map((item) => this.transformInternalCaseToExternalCase(item))
    )

    delete (data as any)?.limit

    return {
      ...data,
      items: casesItems,
    }
  }
}
