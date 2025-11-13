import * as createError from 'http-errors'
import { BadRequest, NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Credentials as LambdaCredentials,
} from 'aws-lambda'
import { Credentials } from '@aws-sdk/client-sts'
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3'
import capitalize from 'lodash/capitalize'
import compact from 'lodash/compact'
import difference from 'lodash/difference'
import isEmpty from 'lodash/isEmpty'
import isEqual from 'lodash/isEqual'
import uniq from 'lodash/uniq'
import uniqBy from 'lodash/uniqBy'
import { MongoClient } from 'mongodb'
import pluralize from 'pluralize'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import { SLAService } from '../sla/sla-service'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { ListService } from '../list'
import { getPaymentMethodId } from '@/utils/payment-details'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { CaseRepository } from '@/services/cases/repository'
import { MAX_TRANSACTION_IN_A_CASE } from '@/constants/case-creation'
import { CasesListResponse } from '@/@types/openapi-internal/CasesListResponse'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import {
  sendWebhookTasks,
  ThinWebhookDeliveryTask,
} from '@/services/webhook/utils'
import { hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { CaseStatusDetails } from '@/@types/openapi-public/CaseStatusDetails'
import { CaseAlertsCommonService } from '@/services/case-alerts-common'
import { getS3ClientByEvent } from '@/utils/s3'
import {
  getMongoDbClient,
  sendMessageToMongoUpdateConsumer,
  withTransaction,
} from '@/utils/mongodb-utils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CaseConfig } from '@/@types/cases/case-config'
import { CaseEscalationsUpdateRequest } from '@/@types/openapi-internal/CaseEscalationsUpdateRequest'
import { AccountsService } from '@/services/accounts'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import {
  getLatestInvestigationTime,
  isCaseAvailable,
} from '@/services/cases/utils'
import { AlertsRepository } from '@/services/alerts/repository'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
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
import { CASES_COLLECTION } from '@/utils/mongo-table-names'
import {
  auditLog,
  AuditLogEntity,
  AuditLogReturnData,
  getCaseAuditLogMetadata,
} from '@/utils/audit-log'
import {
  AuditLogAssignmentsImage,
  CaseUpdateAuditLogImage,
  CommentAuditLogImage,
} from '@/@types/audit-log'
import { getUserUpdateRequest } from '@/utils/case'
import { CommentsResponseItem } from '@/@types/openapi-internal/CommentsResponseItem'
import { updateUserDetails } from '@/utils/user-update-utils'
import { CasesUniquesField } from '@/@types/openapi-internal/CasesUniquesField'

// Custom AuditLogReturnData types
type CaseUpdateAuditLogReturnData = AuditLogReturnData<
  void,
  CaseUpdateAuditLogImage,
  CaseUpdateAuditLogImage
>

type CommentAuditLogReturnData = AuditLogReturnData<
  Comment,
  CommentAuditLogImage,
  CommentAuditLogImage
>

type DeleteCommentAuditLogReturnData = AuditLogReturnData<void, Comment>

type AssignmentAuditLogReturnData = AuditLogReturnData<
  void,
  AuditLogAssignmentsImage,
  AuditLogAssignmentsImage
>

type ViewCaseAuditLogReturnData = AuditLogReturnData<Case, Case, Case>

type EscalateCaseAuditLogReturnData = AuditLogReturnData<
  { assigneeIds: string[] },
  CaseUpdateAuditLogImage,
  CaseUpdateAuditLogImage
>

@traceable
export class CaseService extends CaseAlertsCommonService {
  caseRepository: CaseRepository
  alertsService: AlertsService
  accountsService: AccountsService
  linkerService: LinkerService
  userService: UserService
  transactionsRepository: MongoDbTransactionRepository
  tenantId: string
  mongoDb: MongoClient
  hasFeatureSla: boolean
  slaPolicyService: SLAPolicyService
  auth0Domain: string
  listService: ListService

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
    this.accountsService = AccountsService.getInstance(
      this.caseRepository.dynamoDb,
      true
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
      this.mongoDb,
      this.caseRepository.dynamoDb
    )
    this.linkerService = new LinkerService(this.tenantId)
    this.hasFeatureSla = hasFeature('ALERT_SLA') && hasFeature('PNB')
    this.slaPolicyService = new SLAPolicyService(this.tenantId, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })
    this.auth0Domain = getContext()?.auth0Domain ?? ''
    this.listService = new ListService(this.tenantId, {
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

  public async getComments(caseIds: string[]): Promise<CommentsResponseItem[]> {
    return await this.caseRepository.getComments(caseIds)
  }

  @auditLog('CASE', 'MANUAL_CASE_TRANSACTIONS_ADDITION', 'UPDATE')
  public async updateManualCase(
    caseData: ManualCasePatchRequest
  ): Promise<AuditLogReturnData<Case, { total: number; data: Case[] }, Case>> {
    const { caseId, comment, files = [], transactionIds } = caseData

    const case_ = await this.caseRepository.getCases(
      { filterId: caseId, filterCaseTypes: ['MANUAL'] },
      { includeCaseTransactionIds: true }
    )

    const transactionRepository = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb,
      this.caseRepository.dynamoDb
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

    return {
      result: updatedCase as Case,
      entities: [
        {
          entityId: caseId,
          oldImage: case_,
          newImage: updatedCase as Case,
          logMetadata: getCaseAuditLogMetadata(updatedCase),
        },
      ],
    }
  }

  public async getCaseByAlertId(alertId: string): Promise<Case | null> {
    return await this.caseRepository.getCaseByAlertId(alertId)
  }

  @auditLog('CASE', 'CASE_LIST', 'DOWNLOAD')
  public async getCases(
    params: DefaultApiGetCaseListRequest,
    options?: {
      hideOptionalData?: boolean
      includeAlertTransactionIds?: boolean
    }
  ): Promise<AuditLogReturnData<CasesListResponse>> {
    const result = await this.caseRepository.getCases(params, options)
    result.data = await Promise.all(
      result.data.map(
        async (caseEntity) => await this.getAugmentedCase(caseEntity)
      )
    )
    return {
      result: result,
      entities:
        params.view === 'DOWNLOAD'
          ? [{ entityId: 'CASE_DOWNLOAD', entityAction: 'DOWNLOAD' }]
          : [],
      publishAuditLog: () => params.view === 'DOWNLOAD',
    }
  }

  public async getCaseTransactions(caseId: string) {
    return await this.caseRepository.getCasesTransactions(caseId)
  }

  public async getUserTransactions(userId: string) {
    return await this.caseRepository.getUserTransaction(userId)
  }

  @auditLog('CASE', 'CASE_REPORT', 'DOWNLOAD')
  public async createReport(params: {
    caseId: string
    afterTimestamp: number
    addUserOrPaymentDetails: boolean
    addActivity: boolean
    addTransactions: boolean
    addAlertDetails: boolean
    addOntology: boolean
  }): Promise<AuditLogReturnData<{ downloadUrl: string }>> {
    const caseItem = (await this.getCase(params.caseId)).result

    const now = Date.now()
    const fileName = `${params.caseId}-case-report-${now}.xlsx`

    // Generate report
    const { subjectType = 'USER' } = caseItem
    const report = await createReport(
      this.tenantId,
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
    return {
      result: { downloadUrl },
      entities: [{ entityId: 'CASE_REPORT', entityAction: 'DOWNLOAD' }],
      publishAuditLog: () => true,
    }
  }

  /**
   * Forms the CaseStatusChange object based on the passed parameters
   */
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

  private async sendCaseWebhook(
    cases: Case[],
    updateRequest: CaseStatusUpdate,
    event: WebhookEventType
  ) {
    const webhookTasks: ThinWebhookDeliveryTask<CaseStatusDetails>[] =
      cases.map((case_) => ({
        event,
        triggeredBy: 'MANUAL',
        entityId: case_.caseId as string,
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

    await sendWebhookTasks<CaseStatusDetails>(this.tenantId, webhookTasks)
  }

  private async sendCasesClosedWebhook(
    cases: Case[],
    updateRequest: CaseStatusUpdate
  ) {
    await this.sendCaseWebhook(
      cases,
      updateRequest,
      'CASE_CLOSED' as WebhookEventType
    )
  }

  private async sendCasesEscalatedWebhook(
    cases: Case[],
    updateRequest: CaseStatusUpdate
  ) {
    await this.sendCaseWebhook(
      cases,
      updateRequest,
      'CASE_ESCALATED' as WebhookEventType
    )
  }

  private async updateUserDetails(cases: Case[], updates: CaseStatusUpdate) {
    await updateUserDetails({
      tenantId: this.tenantId,
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
      cases,
      updates,
      getUserUpdateRequest,
    })
  }

  // TODO: FIX THIS
  @auditLog('CASE', 'STATUS_CHANGE', 'UPDATE')
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
  ): Promise<CaseUpdateAuditLogReturnData> {
    const {
      // cascadeAlertsUpdate = true,
      skipReview: skipReviewOption = false,
      account,
      updateChecklistStatus = true,
      externalRequest = false,
    } = options ?? {}

    let skipReview = skipReviewOption
    const statusChange = this.getStatusChange(
      updates,
      options?.bySystem,
      externalRequest
    )

    // override the alerts update as a quickfix for PNB bugs
    const isPNB = hasFeature('PNB')
    const isClosing = updates.caseStatus === 'CLOSED'
    const cascadeAlertsUpdate = isPNB && !isClosing ? false : true

    const cases = await this.caseRepository.getCasesByIds(caseIds)

    const casesNotFound = caseIds.filter(
      (caseId) => !cases.find((c) => c.caseId === caseId)
    )

    if (casesNotFound.length) {
      throw new NotFound(`Cases ${casesNotFound.join(', ')} not found`)
    }

    const context = getContext()
    const accountsService = AccountsService.getInstance(
      this.caseRepository.dynamoDb
    )
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

    if (hasFeature('PNB_DAY_2')) {
      // PNB Phase 2: Skip review for cases where all alerts are sanctions when CLOSING
      // Note: ESCALATED operations should always go through review for all alert types
      const isClosingCase = updates.caseStatus === 'CLOSED'

      if (isPNB && isClosingCase && !skipReview) {
        const allAlerts = cases
          .filter((c) => c.caseType === 'SYSTEM')
          .flatMap((c) => c.alerts ?? [])

        if (allAlerts.length > 0) {
          const allAreSanctions = allAlerts.every(
            (a) => a.ruleNature === 'SCREENING'
          )
          if (allAreSanctions) {
            skipReview = true
          }
        }
      }
    }

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

    const lastStatusChangeUserIdCaseIdMap = new Map<string, string>()

    for (const c of cases) {
      const caseId = c.caseId
      const lastUserId = c.lastStatusChange?.userId
      if (caseId && lastUserId) {
        lastStatusChangeUserIdCaseIdMap.set(caseId, lastUserId)
      }
    }

    await withTransaction(async () => {
      await Promise.all([
        ...(!externalRequest ? [this.updateUserDetails(cases, updates)] : []),
        this.caseRepository.updateStatusOfCases(
          caseIds,
          statusChange,
          isLastInReview,
          lastStatusChangeUserIdCaseIdMap
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
          ? [this.caseRepository.markUnMarkedChecklistItemsDone(caseIds)]
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

        let alertsStatusChange: AlertStatusUpdateRequest

        const otherReason = isReview
          ? `In Review Requested to be ${capitalize(
              updates.caseStatus?.replace('IN_REVIEW_', '')
            )}`
          : capitalize(updates.caseStatus)
        if (updates.caseStatus === 'CLOSED') {
          alertsStatusChange = {
            alertStatus: updates.caseStatus,
            comment: updates.comment,
            reason: updates.reason || [],
            otherReason: updates.otherReason,
            files: updates.files,
          }
        } else {
          const message = `Case of this alert was ${otherReason}`
          alertsStatusChange = {
            alertStatus: updates.caseStatus,
            comment: updates.comment,
            otherReason: message,
            reason: ['Other'],
            files: updates.files,
          }
        }

        const alertIds = alerts.map((a) => a.alertId ?? '')

        // PNB Phase 2: Skip review for sanctions alerts when CLOSING only
        // Note: ESCALATED operations should always go through review for all alert types
        const isPNB = hasFeature('PNB')
        const isPNB_DAY_2 = hasFeature('PNB_DAY_2')
        const isClosingAlerts = updates.caseStatus === 'CLOSED'

        // Split sanctions and non-sanctions alerts for separate processing when closing
        if (
          isPNB &&
          isPNB_DAY_2 &&
          isClosingAlerts &&
          !skipReview &&
          !isLastInReview
        ) {
          const sanctionsAlerts = alerts.filter(
            (a) => a.ruleNature === 'SCREENING'
          )
          const nonSanctionsAlerts = alerts.filter(
            (a) => a.ruleNature !== 'SCREENING'
          )

          // Process separately if we have a mix
          if (sanctionsAlerts.length > 0 && nonSanctionsAlerts.length > 0) {
            await Promise.all([
              // Sanctions: skip review
              this.alertsService.updateStatus(
                sanctionsAlerts.map((a) => a.alertId ?? ''),
                alertsStatusChange,
                {
                  bySystem: true,
                  cascadeCaseUpdates: false,
                  account,
                  skipReview: true, // Skip review for sanctions
                  updateChecklistStatus: false,
                  externalRequest: externalRequest,
                }
              ),
              // Non-sanctions: normal review flow
              this.alertsService.updateStatus(
                nonSanctionsAlerts.map((a) => a.alertId ?? ''),
                alertsStatusChange,
                {
                  bySystem: true,
                  cascadeCaseUpdates: false,
                  account,
                  skipReview: false,
                  updateChecklistStatus: false,
                  externalRequest: externalRequest,
                }
              ),
            ])
            return // Early return, already processed
          }

          // If all are sanctions, skip review
          if (sanctionsAlerts.length === alerts.length) {
            await this.alertsService.updateStatus(
              alertIds,
              alertsStatusChange,
              {
                bySystem: true,
                cascadeCaseUpdates: false,
                account,
                skipReview: true, // Skip review for all sanctions
                updateChecklistStatus: false,
                externalRequest: externalRequest,
              }
            )
            return // Early return
          }
        }

        // Default: process all alerts together (non-PNB or non-sanctions)
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

    if (!externalRequest) {
      if (updates.caseStatus === 'CLOSED') {
        await this.sendCasesClosedWebhook(cases, updates)
      } else if (
        updates.caseStatus === 'ESCALATED' ||
        updates.caseStatus === 'ESCALATED_L2'
      ) {
        await this.sendCasesEscalatedWebhook(cases, updates)
      }
    }

    const auditLogEntitiesPromises = cases.map(async (caseItem) => {
      const newCase =
        (await this.caseRepository.getCaseById(caseItem.caseId ?? '-')) ??
        ({} as Case)
      const oldImage: CaseUpdateAuditLogImage = {
        caseStatus: caseItem.caseStatus,
        reviewAssignments: caseItem.reviewAssignments,
        assignments: caseItem.assignments,
      }
      let investigationTime: number | undefined
      if (updates.caseStatus === 'CLOSED') {
        investigationTime =
          getLatestInvestigationTime(newCase?.statusChanges) || undefined
      }

      const newImage: CaseUpdateAuditLogImage = {
        caseStatus: newCase?.caseStatus,
        reviewAssignments: newCase?.reviewAssignments,
        investigationTime,
        assignments: newCase?.assignments,
        ...updates,
      }
      return {
        entityId: newCase.caseId ?? '-',
        oldImage,
        newImage,
      }
    })

    const auditLogEntities = await Promise.all(auditLogEntitiesPromises)
    return {
      result: undefined,
      entities: auditLogEntities,
    }
  }

  public async applyTransactionAction(transactionAction: TransactionAction) {
    const cases = await this.getCases(
      { filterTransactionIds: transactionAction.transactionIds },
      { includeAlertTransactionIds: true }
    )
    if (!cases) {
      throw new NotFound('Case(s) not found for transactions')
    }
    // NOTE: this piece of code performs a lot of separate requests to the database
    //       however attempts at optimizing it proved no real performance improvements
    //       if futher performance improvements are needed, we should consider moving
    //       this logic into the consumer and executing it asynchronously
    await Promise.all(
      cases.result.data.flatMap((c) => {
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

  @auditLog('CASE', 'VIEW_CASE', 'VIEW')
  public async getCase(
    caseId: string,
    options?: { logAuditLogView?: boolean }
  ): Promise<ViewCaseAuditLogReturnData> {
    const caseEntity = await this.caseRepository.getCaseById(caseId)

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
      result: { ...case_, paymentMethodId },
      entities: [
        {
          entityId: caseId,
          logMetadata: getCaseAuditLogMetadata(caseEntity),
        },
      ],
      publishAuditLog: () => {
        if (options?.logAuditLogView && caseEntity) {
          return true
        } else {
          return false
        }
      },
    }
  }

  @auditLog('CASE', 'COMMENT', 'CREATE')
  public async saveComment(
    caseId: string | undefined,
    comment: Comment
  ): Promise<CommentAuditLogReturnData> {
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
    ])

    const caseEntity = await this.caseRepository.getCaseById(caseId)

    return {
      result: {
        ...savedComment,
        files: await this.getUpdatedFiles(savedComment.files),
      },
      entities: [
        {
          entityId: caseId,
          newImage: {
            ...savedComment,
            body: getParsedCommentBody(savedComment.body),
            mentions,
          },
          logMetadata: getCaseAuditLogMetadata(caseEntity),
        },
      ],
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

  @auditLog('CASE', 'COMMENT', 'DELETE')
  public async deleteCaseComment(
    caseId: string,
    commentId: string
  ): Promise<DeleteCommentAuditLogReturnData> {
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
    })

    return {
      result: undefined,
      entities: [
        {
          entityId: caseId,
          oldImage: comment,
        },
      ],
    }
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

  // TODO: FIX THIS
  @auditLog('CASE', 'STATUS_CHANGE', 'ESCALATE')
  public async escalateCase(
    caseId: string,
    caseUpdateRequest: CaseEscalationsUpdateRequest
  ): Promise<EscalateCaseAuditLogReturnData> {
    const accountsService = AccountsService.getInstance(
      this.caseRepository.dynamoDb
    )
    const accounts = await accountsService.getAllActiveAccounts(this.tenantId)

    const case_ = (await this.getCase(caseId)).result

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
      tags: caseUpdateRequest.tags,
      screeningDetails: caseUpdateRequest.screeningDetails,
      listId: caseUpdateRequest.listId,
    }

    if (
      !isEqual(case_.reviewAssignments, finalReviewAssignments) &&
      finalReviewAssignments?.length
    ) {
      await this.updateReviewAssignments([caseId], finalReviewAssignments)
    }

    // override the alerts update as a quickfix for PNB bugs
    const isPNB = hasFeature('PNB')
    const cascadeAlertsUpdate = isPNB ? false : true

    await this.updateStatus([caseId], statusChange, {
      cascadeAlertsUpdate,
      reviewAssignments: finalReviewAssignments,
    })

    const oldImage: CaseUpdateAuditLogImage = {
      caseStatus: case_.caseStatus,
      reviewAssignments: case_.reviewAssignments,
      assignments: case_.assignments,
    }

    const { reason, updatedTransactions } =
      caseUpdateRequest as CaseUpdateAuditLogImage
    const newImage: CaseUpdateAuditLogImage = {
      ...caseUpdateRequest,
      caseStatus: statusChange.caseStatus,
      reviewAssignments: finalReviewAssignments,
      reason: reason,
      updatedTransactions: updatedTransactions,
      assignments: assignmentsToUpdate,
    }

    const logMetadata = {
      caseAssignment: assignmentsToUpdate ?? [],
      caseCreationTimestamp: case_.createdTimestamp,
      casePriority: case_.priority,
      caseStatus: statusChange.caseStatus,
      reviewAssignments: finalReviewAssignments ?? [],
    }

    return {
      result: { assigneeIds: reviewAssignments.map((v) => v.assigneeUserId) },
      entities: [
        {
          entityId: caseId,
          oldImage,
          newImage,
          logMetadata,
        },
      ],
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
    const slaService = new SLAService(this.tenantId, this.auth0Domain, {
      mongoDb: this.mongoDb,
      dynamoDb: this.caseRepository.dynamoDb,
    })
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
                startedAt: slaDetail?.startedAt,
                timeToWarning: slaDetail?.timeToWarning,
                timeToBreach: slaDetail?.timeToBreach,
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

  // TODO: FIX THIS
  @auditLog('CASE', 'ASSIGNMENT', 'UPDATE')
  public async updateAssignments(
    caseIds: string[],
    assignments: Assignment[]
  ): Promise<AssignmentAuditLogReturnData> {
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

    const auditLogEntity: AuditLogEntity<
      AuditLogAssignmentsImage,
      AuditLogAssignmentsImage
    >[] = []

    caseIds.forEach((caseId) => {
      const oldCase = oldCases.find((c) => c.caseId === caseId)
      auditLogEntity.push({
        entityId: caseId,
        oldImage: {
          assignments: oldCase?.assignments ?? [],
        },
        newImage: {
          assignments: assignments ?? [],
        },
      })
    })

    return {
      result: undefined,
      entities: auditLogEntity,
    }
  }

  @auditLog('CASE', 'REVIEW_ASSIGNMENT', 'UPDATE')
  public async updateReviewAssignments(
    caseIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<AssignmentAuditLogReturnData> {
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

    const auditLogEntity: AuditLogEntity<
      AuditLogAssignmentsImage,
      AuditLogAssignmentsImage
    >[] = []

    caseIds.forEach((caseId) => {
      const oldCase = oldCases.find((c) => c.caseId === caseId)
      auditLogEntity.push({
        entityId: caseId,
        oldImage: {
          assignments: oldCase?.assignments ?? [],
        },
        newImage: {
          assignments: reviewAssignments ?? [],
        },
      })
    })

    return {
      result: undefined,
      entities: auditLogEntity,
    }
  }

  public async getUniques(params: {
    field: CasesUniquesField
    filter?: string
    type: 'CASE' | 'ALERT'
  }): Promise<string[]> {
    return await this.caseRepository.getUniques(params)
  }
}
