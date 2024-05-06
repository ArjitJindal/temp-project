import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import createHttpError from 'http-errors'
import { isEmpty, omitBy, uniq } from 'lodash'
import { UserRepository } from '../users/repositories/user-repository'
import { CasesAlertsTransformer } from './cases-alerts-transformer'
import { CaseRepository } from './repository'
import { Case } from '@/@types/openapi-public-management/Case'
import { Case as CaseInternal } from '@/@types/openapi-internal/Case'
import { CaseCreationRequest } from '@/@types/openapi-public-management/CaseCreationRequest'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { CaseUpdateable } from '@/@types/openapi-public-management/CaseUpdateable'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { PaymentEntityDetails } from '@/@types/openapi-public-management/PaymentEntityDetails'
import { traceable } from '@/core/xray'
import { statusEscalated } from '@/utils/helpers'

@traceable
export class ExternalCaseManagementService {
  private caseRepository: CaseRepository
  private userRepository: UserRepository
  private casesTransformer: CasesAlertsTransformer

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.caseRepository = new CaseRepository(tenantId, connections)
    this.userRepository = new UserRepository(tenantId, connections)
    this.casesTransformer = new CasesAlertsTransformer(tenantId, connections)
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

    const updatedCase = await this.caseRepository.updateCase({
      caseId,
      ...omitBy<Partial<CaseInternal>>(
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
