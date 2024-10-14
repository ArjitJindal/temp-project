import * as createError from 'http-errors'
import { NotFound, BadRequest } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { S3 } from '@aws-sdk/client-s3'
import { capitalize, isEqual, isEmpty, compact, difference } from 'lodash'
import { MongoClient } from 'mongodb'
import pluralize from 'pluralize'
import { getPaymentMethodId } from '../../core/dynamodb/dynamodb-keys'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { CasesAlertsAuditLogService } from './case-alerts-audit-log-service'
import { Comment } from '@/@types/openapi-internal/Comment'
import {
  DefaultApiGetCaseListRequest,
  DefaultApiGetCaseTransactionsRequest,
} from '@/@types/openapi-internal/RequestParameters'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
} from '@/services/cases/repository'
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
import { CaseAlertsCommonService } from '@/services/case-alerts-common'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient, withTransaction } from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { CaseEscalationsUpdateRequest } from '@/@types/openapi-internal/CaseEscalationsUpdateRequest'
import { AccountsService } from '@/services/accounts'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { isCaseAvailable } from '@/services/cases/utils'
import {
  AlertsRepository,
  FLAGRIGHT_SYSTEM_USER,
} from '@/services/alerts/repository'
import { AlertsService } from '@/services/alerts'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import {
  getMentionsFromComments,
  getParsedCommentBody,
  isStatusInReview,
} from '@/utils/helpers'
import { WebhookEventType } from '@/@types/openapi-public/WebhookEventType'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CursorPaginationResponse } from '@/utils/pagination'
import { CaseType } from '@/@types/openapi-internal/CaseType'
import { ManualCasePatchRequest } from '@/@types/openapi-internal/ManualCasePatchRequest'
import { API_USER, UserService } from '@/services/users'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import { traceable } from '@/core/xray'
import { CommentRequest } from '@/@types/openapi-internal/CommentRequest'
import { getCredentialsFromEvent } from '@/utils/credentials'
import { S3Config } from '@/services/aws/s3-service'

@traceable
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
    const dynamoDb = getDynamoDbClientByEvent(event)

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb: client,
      dynamoDb,
    })

    return new CaseService(
      caseRepository,
      s3,
      { documentBucketName: DOCUMENT_BUCKET, tmpBucketName: TMP_BUCKET },
      getCredentialsFromEvent(event)
    )
  }

  constructor(
    caseRepository: CaseRepository,
    s3: S3,
    s3Config: S3Config,
    awsCredentials?: LambdaCredentials
  ) {
    super(s3, s3Config, awsCredentials)
    this.caseRepository = caseRepository
    this.tenantId = caseRepository.tenantId
    this.mongoDb = caseRepository.mongoDb
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
    this.alertsService = new AlertsService(
      alertsRepository,
      this.s3,
      this.s3Config,
      awsCredentials
    )
    this.auditLogService = new CasesAlertsAuditLogService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })
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

    await this.auditLogService.createAuditLog({
      caseId: caseId,
      logAction: 'UPDATE',
      caseDetails: updatedCase,
      newImage: updatedCase,
      oldImage: case_,
      subtype: 'MANUAL_CASE_TRANSACTIONS_ADDITION',
    })

    return updatedCase as Case
  }

  public async getCaseByAlertId(alertId: string): Promise<Case | null> {
    return await this.caseRepository.getCaseByAlertId(alertId)
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest,
    options?: { hideOptionalData?: boolean }
  ): Promise<CasesListResponse> {
    const result = await this.caseRepository.getCases(params, options)

    result.data = await Promise.all(
      result.data.map(
        async (caseEntity) => await this.getAugmentedCase(caseEntity)
      )
    )
    return result
  }

  private getStatusChange(
    updates: CaseStatusUpdate,
    bySystem = false,
    externalRequest?: boolean
  ): CaseStatusChange {
    const userId = externalRequest
      ? API_USER
      : (getContext()?.user as Account)?.id
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
      ...(otherReason ? [otherReason] : []), // Changed logic to display other reason even without other selected as enum from public management API
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
        usersData.push({
          caseId: c.caseId ?? '',
          user: user as User | Business,
        })
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
          return userService.updateUser(user, updateObject, {}, { caseId })
        })
      )
    }
  }

  public async updateStatus(
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
      externalRequest?: boolean
    }
  ): Promise<void> {
    const {
      cascadeAlertsUpdate = true,
      skipReview = false,
      account,
      updateChecklistStatus = true,
      externalRequest = false,
    } = options ?? {}
    const statusChange = this.getStatusChange(
      updates,
      options?.bySystem,
      externalRequest
    )

    const cases = await this.caseRepository.getCasesByIds(caseIds)

    const casesNotFound = caseIds.filter(
      (caseId) => !cases.find((c) => c.caseId === caseId)
    )

    if (casesNotFound.length) {
      throw new NotFound(`Cases ${casesNotFound.join(', ')} not found`)
    }

    const context = getContext()
    const accountsService = await AccountsService.getInstance()
    const userId = externalRequest ? API_USER : (context?.user as Account)?.id
    const accountUser =
      externalRequest || !userId
        ? undefined
        : account ?? (await accountsService.getAccount(userId))
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
      hasFeature('ADVANCED_WORKFLOWS') &&
      !isLastInReview &&
      !externalRequest
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
        ...(!externalRequest
          ? [this.updateKycAndUserState(cases, updates)]
          : []),
        this.caseRepository.updateStatusOfCases(
          caseIds,
          statusChange,
          isLastInReview
        ),
        this.saveCasesComment(caseIds, {
          body: commentBody,
          files: updates.files,
          userId: statusChange.userId,
          type: 'STATUS_CHANGE',
        }),
        ...(isReview &&
        accountUser?.reviewerId &&
        hasFeature('ADVANCED_WORKFLOWS')
          ? [
              this.caseRepository.updateInReviewAssignmentsOfCases(
                caseIds,
                [
                  {
                    assigneeUserId: userId ?? '',
                    assignedByUserId: FLAGRIGHT_SYSTEM_USER,
                    timestamp: Date.now(),
                  },
                ],
                [
                  {
                    assigneeUserId: accountUser.reviewerId,
                    assignedByUserId: userId ?? '',
                    timestamp: Date.now(),
                  },
                ]
              ),
            ]
          : []),
        ...(!externalRequest &&
        casesWithPreviousEscalations?.length &&
        hasFeature('ADVANCED_WORKFLOWS') &&
        updates?.caseStatus === 'CLOSED'
          ? [
              this.caseRepository.updateReviewAssignmentsToAssignments(
                casesWithPreviousEscalations.map((c) => c.caseId ?? '')
              ),
            ]
          : []),
        ...(updateChecklistStatus &&
        hasFeature('QA') &&
        updates.caseStatus === 'CLOSED'
          ? [this.caseRepository.markAllChecklistItemsAsDone(caseIds)]
          : []),
      ])

      await this.auditLogService.handleAuditLogForCaseUpdate(cases, updates)

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
          await this.alertsService.updateReviewAssignments(
            alerts.map((a) => a.alertId ?? ''),
            options.reviewAssignments
          )
        }

        const otherReason = isReview
          ? `In Review Requested to be ${capitalize(
              updates.caseStatus?.replace('IN_REVIEW_', '')
            )}`
          : capitalize(updates.caseStatus)

        const message = `Case of this alert was ${otherReason}`

        const alertsStatusChange: AlertStatusUpdateRequest = {
          alertStatus: updates.caseStatus,
          comment: updates.comment,
          otherReason: message,
          reason: ['Other'],
          files: updates.files,
        }

        const alertIds = alerts.map((a) => a.alertId ?? '')

        await this.alertsService.updateStatus(alertIds, alertsStatusChange, {
          bySystem: true,
          cascadeCaseUpdates: false,
          account,
          skipReview: skipReview || isLastInReview,
          updateChecklistStatus: false,
          externalRequest: externalRequest,
        })
      }
    })

    if (!externalRequest && updates.caseStatus === 'CLOSED') {
      await this.sendCasesClosedWebhook(cases, updates)
    }
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
    const paymentDetails =
      case_.paymentDetails?.origin ?? case_.paymentDetails?.destination
    const paymentMethodId = getPaymentMethodId(paymentDetails)

    return {
      ...case_,
      paymentMethodId,
    }
  }

  public async saveComment(caseId: string | undefined, comment: Comment) {
    if (!caseId) {
      throw new BadRequest('Case id is required')
    }

    const files = await this.s3Service.copyFilesToPermanentBucket(
      comment.files ?? []
    )
    const mentions = getMentionsFromComments(comment.body)
    const userId = getContext()?.user?.id

    const savedComment = await this.caseRepository.saveComment(caseId, {
      ...comment,
      files,
      userId,
    })

    await Promise.all([
      ...(savedComment.id
        ? [this.sendFilesAiSummaryBatchJob([caseId], savedComment.id)]
        : []),
      this.auditLogService.handleAuditLogForCasesComments(caseId, {
        ...savedComment,
        body: getParsedCommentBody(savedComment.body),
        mentions,
      }),
    ])

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  public async saveCommentReply(
    caseId: string,
    parentId: string,
    reply: CommentRequest
  ) {
    const caseEntity = await this.caseRepository.getCaseById(caseId)

    if (!caseEntity) {
      throw new createError.NotFound(`Case ${caseId} not found`)
    }

    const comment = caseEntity?.comments?.find(
      (comment) => comment.id === parentId
    )

    if (!comment) {
      throw new createError.NotFound(`Comment ${parentId} not found`)
    }

    return this.saveComment(caseId, { ...reply, parentId })
  }

  private async sendFilesAiSummaryBatchJob(
    caseIds: string[],
    commentId: string
  ): Promise<void> {
    if (!hasFeature('FILES_AI_SUMMARY')) {
      return
    }

    await Promise.all(
      caseIds.map(
        async (caseId) =>
          await sendBatchJobCommand({
            type: 'FILES_AI_SUMMARY',
            tenantId: this.tenantId,
            parameters: {
              type: 'CASE',
              entityId: caseId,
              commentId,
            },
            awsCredentials: this.awsCredentials,
          })
      )
    )
  }

  private async saveCasesComment(caseIds: string[], comment: Comment) {
    const files = await this.s3Service.copyFilesToPermanentBucket(
      comment.files ?? []
    )

    const savedComment = await this.caseRepository.saveCasesComment(caseIds, {
      ...comment,
      files,
    })

    if (savedComment.id) {
      await this.sendFilesAiSummaryBatchJob(caseIds, savedComment.id)
    }

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  public async deleteCaseComment(caseId: string, commentId: string) {
    const caseEntity = await this.caseRepository.getCaseById(caseId)

    const comment = caseEntity?.comments?.find(
      (comment) => comment.id === commentId
    )

    if (!comment || !caseEntity) {
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
    await this.auditLogService.handleAuditLogForCommentDelete(caseId, comment)
  }

  private async getAugmentedCase(caseEntity: Case) {
    const caseComments = (caseEntity.comments ?? []).filter(
      (comment) => comment.deletedAt == null
    )

    const alerts = (caseEntity.alerts ?? []).map((alert) => {
      const comments = (alert.comments ?? []).filter(
        (comment) => comment.deletedAt == null
      )
      return { ...alert, comments }
    })

    const commentsWithUrl = await Promise.all(
      caseComments.map(async (comment) => ({
        ...comment,
        files: await this.getUpdatedFiles(comment.files),
      }))
    )

    return { ...caseEntity, comments: commentsWithUrl, alerts }
  }

  public async escalateCase(
    caseId: string,
    caseUpdateRequest: CaseEscalationsUpdateRequest
  ): Promise<{ assigneeIds: string[] }> {
    const accountsService = await AccountsService.getInstance()
    const accounts = await accountsService.getAllActiveAccounts()

    const case_ = await this.getCase(caseId)

    if (!case_) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }

    const existingReviewAssignments = case_.reviewAssignments || []
    const escalationAssignments = this.getEscalationAssignments(accounts)

    const reviewAssignments =
      existingReviewAssignments.length > 0
        ? existingReviewAssignments
        : escalationAssignments

    const account = getContext()?.user
    const currentUserId = account?.id

    if (isEmpty(case_.assignments) && currentUserId) {
      caseUpdateRequest.assignments = [
        { assigneeUserId: currentUserId, timestamp: Date.now() },
      ]

      await this.caseRepository.updateAssignments(
        [caseId],
        caseUpdateRequest.assignments ?? []
      )
    }

    if (
      escalationAssignments[0]?.assigneeUserId &&
      case_.caseStatus?.includes('IN_REVIEW')
    ) {
      await this.updateAssignments(
        [caseId],
        [
          {
            assigneeUserId: escalationAssignments[0]?.assigneeUserId,
            assignedByUserId: currentUserId ?? '',
            timestamp: Date.now(),
          },
        ]
      )
    }

    const statusChange: CaseStatusUpdate = {
      reason: caseUpdateRequest.reason,
      caseStatus: 'ESCALATED',
      otherReason: caseUpdateRequest.otherReason,
      comment: caseUpdateRequest.comment,
      files: caseUpdateRequest.files,
      kycStatusDetails: caseUpdateRequest.kycStatusDetails,
      userStateDetails: caseUpdateRequest.userStateDetails,
    }

    await Promise.all([
      this.updateStatus([caseId], statusChange, {
        cascadeAlertsUpdate: true,
        reviewAssignments,
      }),
      !isEqual(case_.reviewAssignments, reviewAssignments) &&
        this.updateReviewAssignments([caseId], reviewAssignments),
    ])

    await this.auditLogService.handleAuditLogForCaseEscalation(
      caseId,
      caseUpdateRequest,
      case_
    )

    return {
      assigneeIds: reviewAssignments.map((v) => v.assigneeUserId),
    }
  }

  public async updateAssignments(
    caseIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    const timestamp = Date.now()

    assignments.forEach((assignment) => {
      assignment.timestamp = timestamp
    })

    const oldCases = await this.caseRepository.getCasesByIds(caseIds)
    if (oldCases.length !== caseIds.length) {
      throw new NotFound(
        `Cases not found: ${difference(
          caseIds,
          oldCases.map((c) => c.caseId)
        ).join(', ')}`
      )
    }

    await Promise.all([
      this.caseRepository.updateAssignments(caseIds, assignments),
      ...caseIds.map(async (caseId) => {
        const oldCase = oldCases.find((c) => c.caseId === caseId)
        await this.auditLogService.handleAuditLogForCaseAssignment(
          caseId,
          { assignments: oldCase?.assignments },
          { assignments }
        )
      }),
    ])
  }

  public async updateReviewAssignments(
    caseIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    const timestamp = Date.now()

    const oldCases = await this.caseRepository.getCasesByIds(caseIds)

    reviewAssignments.forEach((assignment) => {
      assignment.timestamp = timestamp
    })

    await Promise.all([
      this.caseRepository.updateReviewAssignmentsOfCases(
        caseIds,
        reviewAssignments
      ),
      ...caseIds.map(async (caseId) => {
        const oldCase = oldCases.find((c) => c.caseId === caseId)
        await this.auditLogService.handleAuditLogForCaseAssignment(
          caseId,
          { reviewAssignments: oldCase?.reviewAssignments },
          { reviewAssignments }
        )
      }),
    ])
  }
}
