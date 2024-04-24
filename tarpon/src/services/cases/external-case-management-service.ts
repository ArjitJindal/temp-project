import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError from 'http-errors'
import { isEmpty, keyBy, memoize, omitBy, uniq } from 'lodash'
import { CaseRepository } from '../rules-engine/repositories/case-repository'
import { AccountsService } from '../accounts'
import { UserRepository } from '../users/repositories/user-repository'
import { Case } from '@/@types/openapi-public-management/Case'
import { Case as CaseInternal } from '@/@types/openapi-internal/Case'
import { CaseCreationRequest } from '@/@types/openapi-public-management/CaseCreationRequest'
import { getContext } from '@/core/utils/context'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import {
  isStatusInProgress,
  isStatusInReview,
  isStatusOnHold,
  statusEscalated,
} from '@/utils/helpers'
import { STATUSS } from '@/@types/openapi-public-management-custom/Status'
import { Status } from '@/@types/openapi-public-management/Status'
import { CaseUpdateable } from '@/@types/openapi-public-management/CaseUpdateable'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Assignment } from '@/@types/openapi-public-management/Assignment'
import { PaymentEntityDetails } from '@/@types/openapi-public-management/PaymentEntityDetails'

export class ExternalCaseManagementService {
  private tenantId: string
  private mongoDb: MongoClient
  private caseRepository: CaseRepository
  private auth0Domain: string
  private accountService: AccountsService
  private userRepository: UserRepository

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.caseRepository = new CaseRepository(this.tenantId, connections)
    this.auth0Domain =
      getContext()?.settings?.auth0Domain ||
      (process.env.AUTH0_DOMAIN as string)
    this.accountService = new AccountsService(
      { auth0Domain: this.auth0Domain },
      { mongoDb: this.mongoDb }
    )
    this.userRepository = new UserRepository(this.tenantId, connections)
  }

  private getAllAccountsMongo = memoize(
    async (tenantId: string) => {
      const accounts = await this.accountService.getAllAccountsMongo(tenantId)
      return {
        mapByEmail: keyBy(accounts, 'email'),
        list: accounts,
        mapById: keyBy(accounts, 'id'),
      }
    },
    (tenantId) => tenantId
  )

  private async validateCaseCreationRequest(
    requestBody: CaseCreationRequest
  ): Promise<void> {
    const caseId = requestBody.caseId

    if (!caseId) {
      throw new createHttpError.BadRequest(
        `Case id missing in payload. Please provide case id`
      )
    }

    const case_ = await this.caseRepository.getCaseById(caseId)
    // Ignore cases which are C-{number} as they are internal cases
    const caseIdRegex = /^C-\d+$/

    if (caseIdRegex.test(caseId)) {
      throw new createHttpError.BadRequest(
        `Case ID: ${caseId} not allowed for creation reserving C-{number} for internal cases`
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
          `Case ID: ${caseId} is too long. We only support case IDs upto 40 characters`
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
          )}. Please provide case IDs which are already created`
        )
      }
    }
  }

  private async transformAssignmentsToInternalCase(
    assignments: Assignment[]
  ): Promise<CaseInternal['assignments']> {
    const accounts = await this.getAllAccountsMongo(this.tenantId)

    const accountsMap = accounts.mapByEmail

    return assignments.map((assignment) => {
      if (!accountsMap[assignment.assigneeEmail]) {
        throw new createHttpError.BadRequest(
          `Assignee email ${assignment.assigneeEmail} not found`
        )
      }

      if (accountsMap[assignment.assigneeEmail].blocked) {
        throw new createHttpError.BadRequest(
          `Seems like assignee email ${assignment.assigneeEmail} is deleted. You can only assign cases to active users. Please invite ${assignment.assigneeEmail} to the platform or assign to another user`
        )
      }

      if (
        assignment.assignedByEmail &&
        !accountsMap[assignment.assignedByEmail]
      ) {
        throw new createHttpError.BadRequest(
          `Assigned by email ${assignment.assignedByEmail} not found`
        )
      }

      if (
        assignment.assignedByEmail &&
        accountsMap[assignment.assignedByEmail].blocked
      ) {
        throw new createHttpError.BadRequest(
          `Seems like assigned by email ${assignment.assignedByEmail} is deleted. You can only assign cases to active users. Please invite ${assignment.assignedByEmail} to the platform or assign to another user`
        )
      }

      return {
        assigneeUserId: accountsMap[assignment.assigneeEmail].id,
        ...(assignment.assignedByEmail && {
          assignedByUserId: accountsMap[assignment.assignedByEmail]?.id,
        }),
        timestamp: assignment.timestamp || Date.now(),
      }
    })
  }

  private async transformAssignmentsToExternalCase(
    case_: CaseInternal
  ): Promise<Assignment[]> {
    const accounts = await this.getAllAccountsMongo(this.tenantId)

    const accountsMap = accounts.mapById

    const assignments =
      (isStatusInReview(case_.caseStatus)
        ? case_.reviewAssignments
        : case_.assignments) || []

    return assignments.map((assignment) => {
      return {
        assigneeEmail: accountsMap[assignment.assigneeUserId].email,
        assignedByEmail: assignment.assignedByUserId
          ? accountsMap[assignment.assignedByUserId].email
          : undefined,
        timestamp: assignment.timestamp,
      }
    })
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
      await this.transformAssignmentsToInternalCase(
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

  private getExternalCaseStatus(internalCase: CaseStatus): Case['caseStatus'] {
    let externalCaseStatus: Case['caseStatus'] = 'OPEN'

    if (isStatusInReview(internalCase)) {
      externalCaseStatus = 'IN_REVIEW'
    } else if (isStatusInProgress(internalCase)) {
      externalCaseStatus = 'IN_PROGRESS'
    } else if (isStatusOnHold(internalCase)) {
      externalCaseStatus = 'ON_HOLD'
    } else if (statusEscalated(internalCase)) {
      externalCaseStatus = 'ESCALATED'
    } else if (STATUSS.includes(internalCase as Status)) {
      externalCaseStatus = internalCase as Status
    }

    return externalCaseStatus
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

    const externalCaseStatus = this.getExternalCaseStatus(
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
      assignments: await this.transformAssignmentsToExternalCase(internalCase),
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

    const externalCaseStatus = this.getExternalCaseStatus(
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
      ? await this.transformAssignmentsToInternalCase(
          casePatchRequest.assignments
        )
      : undefined

    const user =
      casePatchRequest.entityDetails?.type === 'USER'
        ? await this.getCaseUser(casePatchRequest.entityDetails.userId)
        : undefined

    const updatedCase = await this.caseRepository.updateCase({
      caseId,
      ...omitBy<Partial<CaseInternal>>(
        {
          assignments,
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
      ),
    })

    if (!updatedCase) {
      throw new createHttpError.NotFound(
        `Case with id: ${caseId} not found. You can create a new case by calling POST /cases with id: ${caseId}`
      )
    }

    return await this.transformInternalCaseToExternalCase(updatedCase)
  }
}
