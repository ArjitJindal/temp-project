import * as createError from 'http-errors'
import { NotFound, BadRequest } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { S3 } from '@aws-sdk/client-s3'
import { capitalize, isEqual, isEmpty, compact } from 'lodash'
import { MongoClient } from 'mongodb'
import pluralize from 'pluralize'
import { CasesAlertsAuditLogService } from './case-alerts-audit-log-service'
import { Comment } from '@/@types/openapi-internal/Comment'
import {
  DefaultApiGetCaseListRequest,
  DefaultApiGetCaseTransactionsRequest,
} from '@/@types/openapi-internal/RequestParameters'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
} from '@/services/rules-engine/repositories/case-repository'
import { CasesListResponse } from '@/@types/openapi-internal/CasesListResponse'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import {
  ThinWebhookDeliveryTask,
  sendWebhookTasks,
} from '@/services/webhook/utils'
import { getContext, hasFeature } from '@/core/utils/context'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { CaseClosedDetails } from '@/@types/openapi-public/CaseClosedDetails'
import {
  CaseAlertsCommonService,
  S3Config,
} from '@/services/case-alerts-common'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient, withTransaction } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { CaseEscalationsUpdateRequest } from '@/@types/openapi-internal/CaseEscalationsUpdateRequest'
import { AccountsService } from '@/services/accounts'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { isCaseAvailable } from '@/lambdas/console-api-case/services/utils'
import {
  AlertsRepository,
  FLAGRIGHT_SYSTEM_USER,
} from '@/services/rules-engine/repositories/alerts-repository'
import { AlertsService } from '@/services/alerts'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { isStatusInReview } from '@/utils/helpers'
import { WebhookEventType } from '@/@types/openapi-public/WebhookEventType'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CursorPaginationResponse } from '@/utils/pagination'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { ManualCasePatchRequest } from '@/@types/openapi-internal/ManualCasePatchRequest'
import { background } from '@/utils/background'
import { UserService } from '@/services/users'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { Priority } from '@/@types/openapi-internal/Priority'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'

export class CaseService extends CaseAlertsCommonService {
  caseRepository: CaseRepository
  alertsService: AlertsService
  auditLogService: CasesAlertsAuditLogService
  tenantId: string
  mongoDb: MongoClient

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ): Promise<CaseService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = await getDynamoDbClientByEvent(event)

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb: client,
      dynamoDb,
    })

    return new CaseService(caseRepository, s3, {
      documentBucketName: DOCUMENT_BUCKET,
      tmpBucketName: TMP_BUCKET,
    })
  }

  constructor(caseRepository: CaseRepository, s3: S3, s3Config: S3Config) {
    super(s3, s3Config)
    this.caseRepository = caseRepository
    this.tenantId = caseRepository.tenantId
    this.mongoDb = caseRepository.mongoDb
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
    this.alertsService = new AlertsService(
      alertsRepository,
      this.s3,
      this.s3Config
    )
    this.auditLogService = new CasesAlertsAuditLogService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })
  }

  private getManualCaseComment(
    manualCaseData: CaseStatusChange,
    caseId: string,
    files: FileInfo[],
    transactionIds: string[]
  ): Comment {
    const { comment, reason, otherReason } = manualCaseData
    const { id: userId, email } = getContext()?.user as Account

    const transactionsCount = transactionIds.length

    // Break down string generation into smaller, more meaningful parts
    const createdByText = `Case ${caseId} is manually created by ${
      email ?? userId
    }`
    const reasonText = `with reason: ${reason}${
      reason?.[0] === 'Other' ? `: ${otherReason}` : ''
    }`

    // Individual components for transactionsText
    const transactionsCountText = `${transactionsCount} ${pluralize(
      'transaction',
      transactionsCount
    )}`

    const transactionIdsText = `${pluralize(
      'id',
      transactionsCount
    )} ${transactionIds.join(', ')}`

    // Final transactionsText based on the condition
    const transactionsText = transactionsCount
      ? ` and ${transactionsCountText} with ${transactionIdsText}`
      : ''

    const optionalComment = comment ? `\n${comment}` : ''

    const commentText = `${createdByText} ${reasonText}${transactionsText}${optionalComment}`

    return {
      body: commentText,
      createdAt: Date.now(),
      files,
      updatedAt: Date.now(),
      userId,
    }
  }

  private getUpdateManualCaseComment(
    caseId: string,
    files: FileInfo[],
    transactionIds: string[],
    comment: string
  ): Comment {
    const { id: userId, email } = getContext()?.user as Account

    const tranasctionsCount = transactionIds.length

    const commentText = `Added ${tranasctionsCount} ${pluralize(
      'transaction',
      tranasctionsCount
    )} with ${pluralize('id', tranasctionsCount)} ${transactionIds.join(
      ', '
    )} to case ${caseId} by ${email ?? userId} \n${comment}`

    return {
      body: commentText,
      createdAt: Date.now(),
      files,
      updatedAt: Date.now(),
      userId,
    }
  }

  public async getCaseIdsByUserId(
    userId: string,
    params?: { caseType?: CaseType }
  ): Promise<{ caseIds: string[] }> {
    const cases = await this.caseRepository.getCaseIdsByUserId(userId, params)

    return {
      caseIds: compact(cases.map((c) => c.caseId)),
    }
  }

  public async getCasesTransactions(
    params: DefaultApiGetCaseTransactionsRequest
  ): Promise<CursorPaginationResponse<InternalTransaction>> {
    const { caseId, ...rest } = params
    const case_ = await this.caseRepository.getCaseById(caseId)

    if (!case_) {
      throw new NotFound(`Case ${caseId} not found`)
    }

    const mongoDb = this.caseRepository.mongoDb
    const transactionRepository = new MongoDbTransactionRepository(
      this.tenantId,
      mongoDb
    )

    const caseTransactionsIds = case_.caseTransactionsIds ?? []

    return await transactionRepository.getTransactionsCursorPaginate({
      ...rest,
      filterIdList: caseTransactionsIds,
    })
  }

  public async updateManualCase(
    caseData: ManualCasePatchRequest
  ): Promise<Case> {
    const { caseId, comment, files = [], transactionIds } = caseData

    const case_ = await this.caseRepository.getCases(
      { filterId: caseId, filterCaseTypes: ['MANUAL'] },
      { includeCaseTransactionIds: true }
    )

    const transactionRepository = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    if (!case_.data.length) {
      throw new NotFound(`Case ${caseId} not found`)
    }

    const caseTransactionIds = case_.data[0].caseTransactionsIds ?? []

    if (
      caseTransactionIds.length + transactionIds.length >
      MAX_TRANSACTION_IN_A_CASE
    ) {
      throw new BadRequest(`Case ${caseId} has too many transactions`)
    }

    const allTransactionIds = compact([
      ...new Set([
        ...(case_.data?.[0]?.caseTransactionsIds ?? []),
        ...(transactionIds ?? []),
      ]),
    ])

    const transactionsCount = allTransactionIds.length

    const newTransactionIds = allTransactionIds.filter(
      (id) => !caseTransactionIds.includes(id)
    )

    const transactions = await transactionRepository.getTransactionsByIds(
      newTransactionIds
    )

    const updatedCase = await this.caseRepository.updateManualCase(
      caseId,
      transactions,
      this.getUpdateManualCaseComment(
        caseId,
        files,
        newTransactionIds,
        comment
      ),
      transactionsCount
    )

    return updatedCase as Case
  }

  public async getCaseByAlertId(alertId: string): Promise<Case | null> {
    return await this.caseRepository.getCaseByAlertId(alertId)
  }

  public async createManualCaseFromUser(
    manualCaseData: CaseStatusChange,
    files: FileInfo[],
    transactionIds: string[],
    priority?: Priority
  ): Promise<Case> {
    const { id: userId } = getContext()?.user as Account
    const userRepository = new UserRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })

    const caseUser = await userRepository.getUserById(manualCaseData.userId)

    if (!caseUser) {
      throw new NotFound(`User ${manualCaseData.userId} not found`)
    }

    const statusChange: CaseStatusChange = {
      ...manualCaseData,
      caseStatus: 'OPEN',
      userId,
    }

    const transactionRepository = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )

    const transactions = compact(transactionIds).length
      ? await transactionRepository.getTransactionsByIds(
          compact(transactionIds)
        )
      : []

    const case_ = await this.caseRepository.addCaseMongo({
      caseType: 'MANUAL',
      caseStatus: 'OPEN',
      caseTransactions: transactions,
      caseUsers: {
        origin: caseUser,
        originUserRiskLevel:
          caseUser.drsScore?.manualRiskLevel ??
          caseUser.drsScore?.derivedRiskLevel,
        originUserDrsScore: caseUser.drsScore?.drsScore,
      },
      alerts: [],
      caseTransactionsCount: transactions.length,
      createdBy: manualCaseData.userId,
      priority: priority ?? 'P1',
      updatedAt: Date.now(),
      createdTimestamp: Date.now(),
      caseTransactionsIds: transactions.map((t) => t.transactionId),
      statusChanges: [statusChange],
      lastStatusChange: statusChange,
    })

    const comment = this.getManualCaseComment(
      manualCaseData,
      case_.caseId!,
      files,
      transactions.map((t) => t.transactionId)
    )

    await this.caseRepository.saveCaseComment(case_.caseId!, comment)

    return case_
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest
  ): Promise<CasesListResponse> {
    const result = await this.caseRepository.getCases(params)

    result.data = await Promise.all(
      result.data.map(
        async (caseEntity) => await this.getAugmentedCase(caseEntity)
      )
    )
    return result
  }

  private getStatusChange(
    updates: CaseStatusUpdate,
    bySystem = false
  ): CaseStatusChange {
    const userId = (getContext()?.user as Account).id
    return {
      userId: bySystem
        ? FLAGRIGHT_SYSTEM_USER
        : userId ?? FLAGRIGHT_SYSTEM_USER,
      timestamp: Date.now(),
      reason: updates.reason,
      caseStatus: updates.caseStatus,
      otherReason: updates.otherReason,
    }
  }

  private getCaseCommentBody(
    updateRequest: CaseStatusUpdate,
    currentStatus?: CaseStatus
  ) {
    const { caseStatus, reason, otherReason, comment } = updateRequest
    const isReview = isStatusInReview(caseStatus)
    const currentStatusInReview = isStatusInReview(currentStatus)
    let body = `Case status changed to ${
      isReview ? 'In Review' : capitalize(caseStatus?.toLowerCase())
    }${
      isReview
        ? ' and is requested to be ' +
          capitalize(caseStatus?.replace('IN_REVIEW_', '').toLowerCase())
        : ''
    }`

    if (currentStatusInReview) {
      if (currentStatus?.replace('IN_REVIEW_', '') === caseStatus) {
        body = `Case is Approved and its status is changed to ${capitalize(
          caseStatus?.toLowerCase()
        )}.`
      } else {
        body = `Case is Declined and its status is changed to ${capitalize(
          caseStatus?.toLowerCase()
        )}.`
      }
    }

    const allReasons = [
      ...(reason?.filter((reason) => reason !== 'Other') ?? []),
      ...(reason?.includes('Other') && otherReason ? [otherReason] : []),
    ]

    if (allReasons.length > 0) {
      body += `. Reason${allReasons.length > 1 ? 's' : ''}: ${allReasons.join(
        ', '
      )}`
    }

    if (comment) {
      body += `\n${comment}`
    }

    return body
  }

  private async sendCasesClosedWebhook(
    cases: Case[],
    updateRequest: CaseStatusUpdate
  ) {
    const webhookTasks: ThinWebhookDeliveryTask<CaseClosedDetails>[] =
      cases.map((case_) => ({
        event: 'CASE_CLOSED' as WebhookEventType,
        triggeredBy: 'MANUAL',
        payload: {
          caseId: case_.caseId,
          reasons: updateRequest.reason,
          reasonDescriptionForOther: updateRequest.otherReason,
          status: updateRequest.caseStatus,
          comment: updateRequest.comment,
          userId:
            case_?.caseUsers?.origin?.userId ??
            case_?.caseUsers?.destination?.userId,
          transactionIds: case_?.caseTransactionsIds,
        },
      }))

    await sendWebhookTasks<CaseClosedDetails>(this.tenantId, webhookTasks)
  }

  private async updateKycAndUserState(
    cases: Case[],
    updates: CaseStatusUpdate
  ) {
    const usersData: { caseId: string; user: User | Business }[] = []
    cases.forEach((c) => {
      const user = c?.caseUsers?.origin ?? c?.caseUsers?.destination
      if (user && user.userId) {
        usersData.push({ caseId: c.caseId!, user: user as User | Business })
      }
    })

    const userService = new UserService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })

    const updateObject: UserUpdateRequest = {
      ...(updates.kycStatusDetails?.status && {
        kycStatusDetails: {
          status: updates.kycStatusDetails.status,
          reason: updates.kycStatusDetails.reason,
          description: updates.kycStatusDetails.description,
        },
      }),
      ...(updates.userStateDetails?.state && {
        userStateDetails: {
          state: updates.userStateDetails.state,
          reason: updates.userStateDetails.reason,
          description: updates.userStateDetails.description,
        },
      }),
    }

    if (isEmpty(updateObject)) {
      return
    }

    if (!isEmpty(usersData)) {
      await Promise.all(
        usersData.map(({ user, caseId }) => {
          return userService.updateUser(user, updateObject, {
            caseId,
          })
        })
      )
    }
  }

  public async updateCasesStatus(
    caseIds: string[],
    updates: CaseStatusUpdate,
    options?: {
      bySystem?: boolean
      cascadeAlertsUpdate?: boolean
      reviewAssignments?: Assignment[]
      skipReview?: boolean
      account?: Account
      filterInReview?: boolean
      updateChecklistStatus?: boolean
    }
  ): Promise<void> {
    const {
      cascadeAlertsUpdate = true,
      skipReview = false,
      account,
      updateChecklistStatus = true,
    } = options ?? {}
    const statusChange = this.getStatusChange(updates, options?.bySystem)

    const cases = await this.caseRepository.getCasesByIds(caseIds)

    await background(this.updateKycAndUserState(cases, updates))

    const accountsService = new AccountsService(
      { auth0Domain: process.env.AUTH0_DOMAIN as string },
      { mongoDb: this.mongoDb }
    )

    const userId = getContext()?.user?.id as string

    const accountUser = account ?? (await accountsService.getAccount(userId))
    const isLastInReview = isStatusInReview(
      cases[0].lastStatusChange?.caseStatus
    )
    const isInProgressOrOnHold =
      updates.caseStatus?.endsWith('IN_PROGRESS') ||
      updates.caseStatus?.endsWith('ON_HOLD')

    let isReview = false
    const isReviewRequired = accountUser?.reviewerId ?? false

    if (
      isReviewRequired &&
      !isInProgressOrOnHold &&
      !skipReview &&
      hasFeature('ESCALATION') &&
      !isLastInReview
    ) {
      const caseStatusToChange = `IN_REVIEW_${updates.caseStatus?.replace(
        'IN_REVIEW_',
        ''
      )}`
      updates.caseStatus = caseStatusToChange as CaseStatus
      statusChange.caseStatus = caseStatusToChange as CaseStatus
      isReview = true
    }

    const casesWithPreviousEscalations = cases.filter(
      (c) =>
        c.caseStatus === 'ESCALATED' || c.caseStatus === 'IN_REVIEW_ESCALATED'
    )

    const currentStatus = cases[0].caseStatus

    const commentBody = this.getCaseCommentBody(updates, currentStatus)

    await withTransaction(async () => {
      await Promise.all([
        this.caseRepository.updateStatusOfCases(
          caseIds,
          statusChange,
          isLastInReview
        ),
        this.saveCasesComment(caseIds, {
          body: commentBody,
          files: updates.files,
          userId: statusChange.userId,
        }),
        ...(isReview && accountUser.reviewerId && hasFeature('ESCALATION')
          ? [
              this.caseRepository.updateInReviewAssignmentsOfCases(
                caseIds,
                [
                  {
                    assigneeUserId: userId!,
                    assignedByUserId: FLAGRIGHT_SYSTEM_USER,
                    timestamp: Date.now(),
                  },
                ],
                [
                  {
                    assigneeUserId: accountUser.reviewerId,
                    assignedByUserId: userId!,
                    timestamp: Date.now(),
                  },
                ]
              ),
            ]
          : []),
        ...(casesWithPreviousEscalations?.length &&
        hasFeature('ESCALATION') &&
        updates?.caseStatus === 'CLOSED'
          ? [
              this.caseRepository.updateReviewAssignmentsToAssignments(
                casesWithPreviousEscalations.map((c) => c.caseId!)
              ),
            ]
          : []),
        ...(updateChecklistStatus &&
        hasFeature('QA') &&
        updates.caseStatus === 'CLOSED'
          ? [this.caseRepository.markAllChecklistItemsAsDone(caseIds)]
          : []),
      ])

      if (updates.caseStatus && cascadeAlertsUpdate && !isInProgressOrOnHold) {
        const alerts = cases
          .filter((c) => c.caseType === 'SYSTEM')
          .flatMap((c) => c.alerts ?? [])
          .filter(
            (alert) =>
              ![...new Set(['CLOSED', updates.caseStatus])].includes(
                alert.alertStatus
              )
          )
          .filter((alert) => {
            if (options?.filterInReview) {
              return !isStatusInReview(alert.alertStatus)
            }
            return true
          })

        if (!alerts.length) {
          return
        }

        if (updates.caseStatus === 'ESCALATED' && options?.reviewAssignments) {
          await this.alertsService.updateAlertsReviewAssignments(
            alerts.map((a) => a.alertId!),
            options.reviewAssignments
          )
        }

        const otherReason = isReview
          ? `In Review Requested to be ${capitalize(
              updates.caseStatus?.replace('IN_REVIEW_', '')
            )}`
          : capitalize(updates.caseStatus)

        const message = `Case of this alert was ${otherReason}`

        const alertsStatusChange = {
          alertStatus: updates.caseStatus,
          comment: updates.comment,
          otherReason: message,
          reason: ['Other'],
          files: updates.files,
        } as AlertStatusUpdateRequest

        const alertIds = alerts.map((a) => a.alertId!)
        await Promise.all([
          this.alertsService.updateAlertsStatus(alertIds, alertsStatusChange, {
            bySystem: true,
            cascadeCaseUpdates: false,
            account,
            skipReview: skipReview || isLastInReview,
            updateChecklistStatus: false,
          }),
          this.auditLogService.handleAuditLogForAlertsUpdate(
            alertIds,
            alertsStatusChange,
            'STATUS_CHANGE'
          ),
        ])
      }
    })

    if (updates.caseStatus === 'CLOSED') {
      await this.sendCasesClosedWebhook(cases, updates)
    }

    if (updates.caseStatus === 'CLOSED' && hasFeature('SANCTIONS')) {
      await Promise.all(
        cases.map(async (c) => {
          const userId =
            c?.caseUsers?.origin?.userId ?? c?.caseUsers?.destination?.userId
          const alerts = c?.alerts ?? []
          if (userId && alerts.length) {
            await this.alertsService.whiltelistSanctionEntities(userId, alerts)
          }
        })
      )
    }
    return
  }

  public async getCase(
    caseId: string,
    options?: { logAuditLogView?: boolean }
  ): Promise<Case> {
    const caseEntity = await this.caseRepository.getCaseById(caseId)

    if (options?.logAuditLogView) {
      await this.auditLogService.handleViewCase(caseId)
    }

    const case_ =
      (caseEntity &&
        isCaseAvailable(caseEntity) &&
        (await this.getAugmentedCase(caseEntity))) ||
      null

    if (case_ == null) {
      throw new NotFound(`Case not found: ${caseId}`)
    }

    return case_
  }

  public async saveCaseComment(caseId: string | undefined, comment: Comment) {
    // Copy the files from tmp bucket to document bucket
    if (!caseId) {
      throw new BadRequest('Case id is required')
    }
    const files = await this.copyFiles(comment.files ?? [])

    const savedComment = await this.caseRepository.saveCaseComment(caseId, {
      ...comment,
      files,
    })

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  private async saveCasesComment(caseIds: string[], comment: Comment) {
    const files = await this.copyFiles(comment.files ?? [])

    const savedComment = await this.caseRepository.saveCasesComment(caseIds, {
      ...comment,
      files,
    })

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  public async deleteCaseComment(caseId: string, commentId: string) {
    const caseEntity = await this.caseRepository.getCaseById(caseId)
    if (!caseEntity) {
      throw new createError.NotFound(`Case ${caseId} not found`)
    }

    const comment = caseEntity?.comments?.find(
      (comment) => comment.id === commentId
    )
    if (!comment) {
      throw new createError.NotFound(`Comment ${commentId} not found`)
    }

    if (comment.files && comment.files.length > 0) {
      await this.s3.deleteObjects({
        Bucket: this.s3Config.documentBucketName,
        Delete: { Objects: comment.files.map((file) => ({ Key: file.s3Key })) },
      })
    }
    await withTransaction(async () => {
      await this.caseRepository.deleteCaseComment(caseId, commentId)
      await this.handleAuditLogForDeleteComment(comment, caseId)
    })
  }

  private async handleAuditLogForDeleteComment(
    comment: Comment,
    caseId: string
  ) {
    const casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      this.tenantId,
      {
        mongoDb: this.mongoDb,
        dynamoDb: this.caseRepository.dynamoDb,
      }
    )

    await casesAlertsAuditLogService.handleAuditLogForCommentDelete(
      caseId,
      comment
    )
  }

  private async getAugmentedCase(caseEntity: Case) {
    const commentsWithUrl = await Promise.all(
      await (caseEntity.comments ?? []).map(async (comment) => ({
        ...comment,
        files: await this.getUpdatedFiles(comment.files),
      }))
    )

    return { ...caseEntity, comments: commentsWithUrl }
  }

  public async escalateCase(
    caseId: string,
    caseUpdateRequest: CaseEscalationsUpdateRequest
  ): Promise<{ assigneeIds: string[] }> {
    const accountsService = new AccountsService(
      { auth0Domain: process.env.AUTH0_DOMAIN as string },
      { mongoDb: this.caseRepository.mongoDb }
    )
    const accounts = await accountsService.getAllActiveAccounts()

    const case_ = await this.getCase(caseId)

    if (!case_) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }

    const existingReviewAssignments = case_.reviewAssignments || []

    const reviewAssignments =
      existingReviewAssignments.length > 0
        ? existingReviewAssignments
        : this.getEscalationAssignments(accounts)

    const account = getContext()?.user

    if (isEmpty(case_.assignments) && account?.id) {
      caseUpdateRequest.assignments = [
        { assigneeUserId: account.id, timestamp: Date.now() },
      ]

      await this.caseRepository.updateCasesAssignments(
        [caseId],
        caseUpdateRequest.assignments ?? []
      )
    }

    const statusChange: CaseStatusUpdate = {
      reason: caseUpdateRequest.reason,
      caseStatus: 'ESCALATED',
      otherReason: caseUpdateRequest.otherReason,
      comment: caseUpdateRequest.comment,
      files: caseUpdateRequest.files,
    }

    await Promise.all([
      this.updateCasesStatus([caseId], statusChange, {
        cascadeAlertsUpdate: true,
        reviewAssignments,
      }),
      !isEqual(case_.reviewAssignments, reviewAssignments) &&
        this.updateCasesReviewAssignments([caseId], reviewAssignments),
    ])

    return {
      assigneeIds: reviewAssignments.map((v) => v.assigneeUserId),
    }
  }

  public async updateCasesAssignments(
    caseIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    const timestamp = Date.now()

    assignments.forEach((assignment) => {
      assignment.timestamp = timestamp
    })

    await this.caseRepository.updateCasesAssignments(caseIds, assignments)
  }

  public async updateCasesReviewAssignments(
    caseIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    const timestamp = Date.now()

    reviewAssignments.forEach((assignment) => {
      assignment.timestamp = timestamp
    })

    await this.caseRepository.updateReviewAssignmentsOfCases(
      caseIds,
      reviewAssignments
    )
  }
}
