import * as createError from 'http-errors'
import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3'
import {
  capitalize,
  compact,
  difference,
  isEmpty,
  isEqual,
  uniq,
  uniqBy,
} from 'lodash'
import { MongoClient } from 'mongodb'
import pluralize from 'pluralize'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getPaymentMethodId } from '../../core/dynamodb/dynamodb-keys'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { SLAService } from '../sla/sla-service'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { CasesAlertsReportAuditLogService } from './case-alerts-report-audit-log-service'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import {
  CaseRepository,
  MAX_TRANSACTION_IN_A_CASE,
} from '@/services/cases/repository'
import { CasesListResponse } from '@/@types/openapi-internal/CasesListResponse'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import {
  sendWebhookTasks,
  ThinWebhookDeliveryTask,
} from '@/services/webhook/utils'
import { getContext, hasFeature } from '@/core/utils/context'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { CaseClosedDetails } from '@/@types/openapi-public/CaseClosedDetails'
import { CaseAlertsCommonService } from '@/services/case-alerts-common'
import { getS3ClientByEvent } from '@/utils/s3'
import {
  getMongoDbClient,
  sendMessageToMongoUpdateConsumer,
  withTransaction,
} from '@/utils/mongodb-utils'
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
  statusEscalated,
} from '@/utils/helpers'
import { WebhookEventType } from '@/@types/openapi-public/WebhookEventType'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
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
import { createReport } from '@/services/cases/utils/report'
import * as XlsxGenerator from '@/services/cases/utils/xlsx-generator'
import { LinkerService } from '@/services/linker'
import { SLAPolicy } from '@/@types/openapi-internal/SLAPolicy'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'
import { TransactionAction } from '@/@types/openapi-internal/TransactionAction'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'

@traceable
export class CaseService extends CaseAlertsCommonService {
  caseRepository: CaseRepository
  alertsService: AlertsService
  accountsService: AccountsService
  linkerService: LinkerService
  userService: UserService
  transactionsRepository: MongoDbTransactionRepository
  auditLogService: CasesAlertsReportAuditLogService
  tenantId: string
  mongoDb: MongoClient
  hasFeatureSla: boolean
  slaPolicyService: SLAPolicyService
  auth0Domain: string

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
    super(s3, s3Config, awsCredentials, caseRepository)
    this.caseRepository = caseRepository
    this.tenantId = caseRepository.tenantId
    this.mongoDb = caseRepository.mongoDb
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })
    this.alertsService = new AlertsService(
      alertsRepository,
      this.s3,
      this.s3Config,
      awsCredentials
    )
    this.auditLogService = new CasesAlertsReportAuditLogService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })
    this.accountsService = new AccountsService(
      { auth0Domain: getContext()?.auth0Domain as string },
      { mongoDb: this.mongoDb }
    )
    this.userService = new UserService(
      this.tenantId,
      {
        mongoDb: this.mongoDb,
        dynamoDb: this.caseRepository.dynamoDb,
      },
      this.s3,
      this.s3Config.tmpBucketName,
      this.s3Config.documentBucketName,
      this.awsCredentials
    )
    this.transactionsRepository = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )
    this.linkerService = new LinkerService(this.tenantId)
    this.hasFeatureSla = hasFeature('ALERT_SLA') && hasFeature('PNB')
    this.slaPolicyService = new SLAPolicyService(this.tenantId, this.mongoDb)
    this.auth0Domain = getContext()?.auth0Domain ?? ''
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

  public async getCaseTransactions(caseId: string) {
    return await this.caseRepository.getCasesTransactions(caseId)
  }

  public async getUserTransactions(userId: string) {
    return await this.caseRepository.getUserTransaction(userId)
  }

  public async createReport(params: {
    caseId: string
    afterTimestamp: number
    addUserOrPaymentDetails: boolean
    addActivity: boolean
    addTransactions: boolean
    addAlertDetails: boolean
    addOntology: boolean
  }): Promise<{ downloadUrl: string }> {
    const caseItem = await this.getCase(params.caseId)

    const now = Date.now()
    const fileName = `${params.caseId}-case-report-${now}.xlsx`

    // Generate report
    const { subjectType = 'USER' } = caseItem
    const report = await createReport(
      caseItem,
      {
        afterTimestamp: params.afterTimestamp,
        addActivity: params.addActivity,
        addTransactions: params.addTransactions,
        addUserDetails:
          params.addUserOrPaymentDetails && subjectType === 'USER',
        addPaymentDetails:
          params.addUserOrPaymentDetails && subjectType === 'PAYMENT',
        addAlertDetails:
          params.addAlertDetails && caseItem.caseType !== 'MANUAL',
        addOntology: params.addOntology && hasFeature('ENTITY_LINKING'),
      },
      this.accountsService,
      this.transactionsRepository,
      this.linkerService
    )
    const dataStream = await XlsxGenerator.convert(report)

    // Upload to temporal dir
    const key = `${this.tenantId}/${fileName}`
    const parallelUploadS3 = new Upload({
      client: this.s3,
      params: {
        Bucket: this.s3Config.tmpBucketName,
        Key: key,
        Body: dataStream,
      },
    })
    await parallelUploadS3.done()

    // Create a download link
    const getObjectCommand = new GetObjectCommand({
      Bucket: this.s3Config.tmpBucketName,
      Key: key,
    })
    const downloadUrl = await getSignedUrl(this.s3, getObjectCommand, {
      expiresIn: 3600,
    })
    return { downloadUrl }
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

    const casesWithPreviousEscalations = cases.filter((c) =>
      statusEscalated(c.caseStatus)
    )

    const currentStatus = cases[0].caseStatus

    const commentBody = this.getCaseCommentBody(updates, currentStatus)
    let slaPolicies: SLAPolicy[] = []
    if (this.hasFeatureSla) {
      slaPolicies = (
        await this.slaPolicyService.getSLAPolicies({
          type: 'MANUAL_CASE',
        })
      ).items
    }

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
        ...(this.hasFeatureSla
          ? cases.map(async (c) =>
              this.updateManualCaseWithSlaDetails(
                {
                  ...c,
                  caseStatus: updates.caseStatus,
                  lastStatusChange: statusChange,
                  statusChanges: [...(c.statusChanges ?? []), statusChange],
                },
                Date.now(),
                slaPolicies
              )
            )
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

        if (statusEscalated(updates.caseStatus) && options?.reviewAssignments) {
          await this.alertsService.updateReviewAssignments(
            alerts.map((a) => a.alertId ?? ''),
            isReview && accountUser?.reviewerId
              ? [
                  {
                    assigneeUserId: accountUser.reviewerId,
                    assignedByUserId: userId ?? '',
                    timestamp: Date.now(),
                  },
                ] // As for already in review alerts we don't go through the review flow in alert status update method.
              : options.reviewAssignments
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

  public async applyTransactionAction(transactionAction: TransactionAction) {
    const cases = await this.getCases({
      filterTransactionIds: transactionAction.transactionIds,
    })
    if (!cases) {
      throw new NotFound('Case(s) not found for transactions')
    }
    // NOTE: this piece of code performs a lot of separate requests to the database
    //       however attempts at optimizing it proved no real performance improvements
    //       if futher performance improvements are needed, we should consider moving
    //       this logic into the consumer and executing it asynchronously
    await Promise.all(
      cases.data.flatMap((c) => {
        if (!c.alerts) {
          return []
        }
        return c.alerts.flatMap((alert) => {
          const txnIds = transactionAction.transactionIds.filter((tid) =>
            alert.transactionIds?.includes(tid)
          )

          if (txnIds.length > 0 && alert.alertId) {
            const promises: Promise<any>[] = []

            if (alert.ruleAction === 'SUSPEND') {
              const commentBody: string =
                txnIds.join(', ') +
                ` set to ` +
                transactionAction.action +
                `. Reasons: ` +
                transactionAction.reason.join(', ') +
                `. Comment: ` +
                transactionAction.comment
              promises.push(
                this.alertsService.saveComment(alert.alertId, {
                  body: commentBody,
                  files: transactionAction.files,
                })
              )
            }

            if (transactionAction.action === 'ALLOW') {
              promises.push(
                this.alertsService.closeAlertIfAllTransactionsApproved(
                  alert,
                  txnIds
                )
              )
            }

            return promises
          }
          return []
        })
      })
    )
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

    if (caseEntity.caseUsers?.origin?.userId) {
      const userId = caseEntity.caseUsers?.origin?.userId
      caseEntity = {
        ...caseEntity,
        caseUsers: {
          ...caseEntity.caseUsers,
          origin: await this.userService.getUser(userId),
        },
      }
    }

    if (caseEntity.caseUsers?.destination?.userId) {
      const userId = caseEntity.caseUsers?.destination?.userId
      caseEntity = {
        ...caseEntity,
        caseUsers: {
          ...caseEntity.caseUsers,
          destination: await this.userService.getUser(userId),
        },
      }
    }

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

    const reviewAssignments = await this.getEscalationAssignments(
      case_.caseStatus as CaseStatus,
      !isStatusInReview(case_.caseStatus) ? case_.reviewAssignments ?? [] : [],
      accounts
    )

    const finalReviewAssignments = !isStatusInReview(case_.caseStatus)
      ? uniqBy(
          [...(case_.reviewAssignments ?? []), ...reviewAssignments],
          'assigneeUserId'
        )
      : reviewAssignments

    const account = getContext()?.user
    const currentUserId = account?.id
    const isL2Escalation =
      statusEscalated(case_.caseStatus) && !isStatusInReview(case_.caseStatus)

    let caseAssignments = case_.assignments ?? []
    let assignmentsToUpdate: Assignment[] = []

    if (isEmpty(caseAssignments) && currentUserId) {
      assignmentsToUpdate = caseAssignments = [
        {
          assigneeUserId: currentUserId,
          timestamp: Date.now(),
          assignedByUserId: currentUserId,
          escalationLevel: isL2Escalation ? 'L2' : 'L1',
        },
      ]
    }

    if (
      caseAssignments[0]?.assigneeUserId &&
      isStatusInReview(case_.caseStatus)
    ) {
      assignmentsToUpdate = [
        {
          assigneeUserId: caseAssignments[0]?.assigneeUserId,
          assignedByUserId: currentUserId ?? '',
          timestamp: Date.now(),
          escalationLevel: isL2Escalation ? 'L2' : 'L1',
        },
      ]
    }

    if (!isEmpty(assignmentsToUpdate)) {
      await this.updateAssignments([caseId], assignmentsToUpdate)
    }

    const statusChange: CaseStatusUpdate = {
      reason: caseUpdateRequest.reason,
      caseStatus:
        hasFeature('MULTI_LEVEL_ESCALATION') && isL2Escalation
          ? 'ESCALATED_L2'
          : 'ESCALATED',
      otherReason: caseUpdateRequest.otherReason,
      comment: caseUpdateRequest.comment,
      files: caseUpdateRequest.files,
      kycStatusDetails: caseUpdateRequest.kycStatusDetails,
      userStateDetails: caseUpdateRequest.userStateDetails,
    }

    if (
      !isEqual(case_.reviewAssignments, finalReviewAssignments) &&
      finalReviewAssignments?.length
    ) {
      await this.updateReviewAssignments([caseId], finalReviewAssignments)
    }

    await this.updateStatus([caseId], statusChange, {
      cascadeAlertsUpdate: true,
      reviewAssignments: finalReviewAssignments,
    })

    await this.auditLogService.handleAuditLogForCaseEscalation(
      caseId,
      caseUpdateRequest,
      case_
    )

    return {
      assigneeIds: reviewAssignments.map((v) => v.assigneeUserId),
    }
  }

  private async updateManualCaseWithSlaDetails(
    c: Case,
    timestamp: number,
    slaPolicies: SLAPolicy[]
  ) {
    if (c.caseType != 'MANUAL') {
      return
    }
    const slaPolicyIds = slaPolicies.map((slaPolicy) => slaPolicy.id)
    const slaService = new SLAService(
      this.tenantId,
      this.mongoDb,
      this.auth0Domain
    )
    const slaPolicyDetails: SLAPolicyDetails[] = await Promise.all(
      slaPolicyIds.map(async (id) => {
        const slaDetail = await slaService.calculateSLAStatusForEntity<Case>(
          c,
          id,
          'case'
        )
        return {
          slaPolicyId: id,
          updatedAt: timestamp,
          ...(slaDetail?.elapsedTime
            ? {
                elapsedTime: slaDetail?.elapsedTime,
                policyStatus: slaDetail?.policyStatus,
              }
            : {}),
        }
      }) || []
    )
    await sendMessageToMongoUpdateConsumer({
      filter: {
        caseId: c.caseId,
      },
      operationType: 'updateOne',
      updateMessage: {
        $set: { slaPolicyDetails },
      },
      sendToClickhouse: true,
      collectionName: CASES_COLLECTION(this.tenantId),
    })
  }

  public async updateAssignments(
    caseIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    const timestamp = Date.now()

    assignments.forEach((assignment) => {
      assignment.timestamp = timestamp
    })

    let slaPolicies: SLAPolicy[] = []
    if (this.hasFeatureSla) {
      slaPolicies = (
        await this.slaPolicyService.getSLAPolicies({
          type: 'MANUAL_CASE',
        })
      ).items
    }

    const oldCases = await this.caseRepository.getCasesByIds(caseIds)
    const oldCasesIds = oldCases.map((c) => c.caseId)
    const uniqueOldCasesIds = uniq(oldCasesIds)

    if (uniqueOldCasesIds.length !== uniq(caseIds).length) {
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
      ...(this.hasFeatureSla
        ? oldCases.map(async (c) =>
            this.updateManualCaseWithSlaDetails(
              {
                ...c,
                assignments,
              },
              timestamp,
              slaPolicies
            )
          )
        : []),
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

    let slaPolicies: SLAPolicy[] = []
    if (this.hasFeatureSla) {
      slaPolicies = (
        await this.slaPolicyService.getSLAPolicies({
          type: 'MANUAL_CASE',
        })
      ).items
    }

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
      ...(this.hasFeatureSla
        ? oldCases.map(async (c) =>
            this.updateManualCaseWithSlaDetails(
              {
                ...c,
                reviewAssignments,
              },
              timestamp,
              slaPolicies
            )
          )
        : []),
    ])
  }
}
