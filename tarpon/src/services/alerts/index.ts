import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3 } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { BadRequest, Forbidden, NotFound } from 'http-errors'
import {
  capitalize,
  isEmpty,
  omit,
  startCase,
  toLower,
  uniq,
  isEqual,
  cloneDeep,
} from 'lodash'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { uuid4 } from '@sentry/utils'
import {
  AlertsRepository,
  FLAGRIGHT_SYSTEM_USER,
} from '../rules-engine/repositories/alerts-repository'
import { CaseAlertsCommonService, S3Config } from '../case-alerts-common'
import { CaseRepository } from '../rules-engine/repositories/case-repository'
import { sendWebhookTasks, ThinWebhookDeliveryTask } from '../webhook/utils'
import { SanctionsService } from '../sanctions'
import { ChecklistTemplatesService } from '../tenants/checklist-template-service'
import { MongoDbTransactionRepository } from '../rules-engine/repositories/mongodb-transaction-repository'
import { Alert } from '@/@types/openapi-internal/Alert'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetAlertTransactionListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { addNewSubsegment, traceable } from '@/core/xray'
import { CaseEscalationRequest } from '@/@types/openapi-internal/CaseEscalationRequest'
import { CaseService } from '@/lambdas/console-api-case/services/case-service'
import { getContext, hasFeature } from '@/core/utils/context'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { Comment } from '@/@types/openapi-internal/Comment'
import { CaseHierarchyDetails } from '@/@types/openapi-internal/CaseHierarchyDetails'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { AlertClosedDetails } from '@/@types/openapi-public/AlertClosedDetails'
import {
  CursorPaginationResponse,
  OptionalPagination,
} from '@/utils/pagination'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { AccountsService } from '@/services/accounts'
import { isAlertAvailable } from '@/lambdas/console-api-case/services/utils'
import { CasesAlertsAuditLogService } from '@/lambdas/console-api-case/services/case-alerts-audit-log-service'
import { getMongoDbClient, withTransaction } from '@/utils/mongodb-utils'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { isStatusInReview } from '@/utils/helpers'
import { ChecklistStatus } from '@/@types/openapi-internal/ChecklistStatus'
import { AlertQaStatusUpdateRequest } from '@/@types/openapi-internal/AlertQaStatusUpdateRequest'
import { ChecklistDoneStatus } from '@/@types/openapi-internal/ChecklistDoneStatus'

@traceable
export class AlertsService extends CaseAlertsCommonService {
  alertsRepository: AlertsRepository
  auditLogService: CasesAlertsAuditLogService
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ): Promise<AlertsService> {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const s3 = getS3ClientByEvent(event)
    const dynamoDb = getDynamoDbClientByEvent(event)
    const repo = new AlertsRepository(tenantId, { mongoDb, dynamoDb })
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as CaseConfig

    return new AlertsService(repo, s3, {
      documentBucketName: DOCUMENT_BUCKET,
      tmpBucketName: TMP_BUCKET,
    })
  }

  constructor(alertsRepository: AlertsRepository, s3: S3, s3Config: S3Config) {
    super(s3, s3Config)
    this.alertsRepository = alertsRepository
    this.tenantId = alertsRepository.tenantId
    this.mongoDb = alertsRepository.mongoDb
    this.dynamoDb = alertsRepository.dynamoDb
    this.auditLogService = new CasesAlertsAuditLogService(
      alertsRepository.tenantId,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )
  }

  public static transactionsToAlerts(
    caseTransactions: InternalTransaction[],
    caseId?: string
  ): Alert[] {
    const alertMap: { [key: string]: Alert } = {}
    caseTransactions.map((transaction) => {
      transaction.hitRules.map(async (hitRule) => {
        if (!(hitRule.ruleInstanceId in alertMap)) {
          alertMap[hitRule.ruleInstanceId] = {
            caseId: caseId,
            createdTimestamp: transaction.timestamp,
            latestTransactionArrivalTimestamp: transaction.timestamp,
            alertStatus: 'OPEN',
            ruleId: hitRule.ruleId,
            ruleInstanceId: hitRule.ruleInstanceId,
            ruleName: hitRule.ruleName,
            ruleDescription: hitRule.ruleDescription,
            ruleAction: hitRule.ruleAction,
            ruleNature: hitRule.nature,
            numberOfTransactionsHit: 1,
            transactionIds: [transaction.transactionId],
            priority: 'P1',
            statusChanges: [],
          }
        } else {
          const alert = alertMap[hitRule.ruleInstanceId]
          const txnSet = new Set(alert.transactionIds).add(
            transaction.transactionId
          )
          alertMap[hitRule.ruleInstanceId] = {
            caseId: caseId,
            ...alert,
            numberOfTransactionsHit: txnSet.size,
            latestTransactionArrivalTimestamp: transaction.timestamp,
            transactionIds: Array.from(txnSet),
          }
        }
      })
    })
    return Object.values(alertMap)
  }

  public async getAlerts(
    params: DefaultApiGetAlertListRequest,
    options?: { hideTransactionIds?: boolean }
  ): Promise<AlertListResponse> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Alerts Query'
    )

    try {
      return await this.alertsRepository.getAlerts(params, options)
    } finally {
      caseGetSegment?.close()
    }
  }

  public async getAlert(alertId: string): Promise<Alert | null> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Alert Query'
    )

    try {
      const alert = await this.alertsRepository.getAlertById(alertId)
      if (!alert || !isAlertAvailable(alert)) {
        throw new NotFound(`No alert for ${alertId}`)
      }

      alert.comments = await Promise.all(
        (alert.comments ?? []).map(async (c) => {
          if (!c.files) {
            return c
          }
          const files = await Promise.all(
            (c.files ?? []).map(async (f) => {
              return {
                ...f,
                downloadLink: await this.getDownloadLink(f),
              }
            })
          )
          return {
            ...c,
            files,
          }
        })
      )

      return alert
    } finally {
      caseGetSegment?.close()
    }
  }

  public async validateAlertsQAStatus(alertIds: string[]): Promise<boolean> {
    const alerts = await this.alertsRepository.validateAlertsQAStatus(alertIds)
    const requiredAlerts = alerts.filter((alert) =>
      alertIds.includes(alert.alertId!)
    )
    return requiredAlerts.every((alert) =>
      alert.ruleChecklist?.every((item) => item.status)
    )
  }

  public async escalateAlerts(
    caseId: string,
    caseEscalationRequest: CaseEscalationRequest
  ): Promise<{ childCaseId?: string; assigneeIds: string[] }> {
    const accountsService = new AccountsService(
      { auth0Domain: process.env.AUTH0_DOMAIN as string },
      { mongoDb: this.mongoDb }
    )
    const transactionsRepo = new MongoDbTransactionRepository(
      this.tenantId,
      this.mongoDb
    )
    const accounts = await accountsService.getAllActiveAccounts()
    const currentUserId = getContext()?.user?.id
    const currentUserAccount = accounts.find((a) => a.id === currentUserId)

    if (!currentUserAccount) {
      throw new Forbidden('User not found or deleted')
    }

    const isReviewRequired = currentUserAccount.reviewerId ?? false

    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    const caseService = new CaseService(caseRepository, this.s3, this.s3Config)

    const c = await caseService.getCase(caseId)
    if (!c) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }
    if (c.caseHierarchyDetails?.parentCaseId) {
      throw new BadRequest(
        `Cannot escalated an already escalated case. Parent case ${c.caseHierarchyDetails?.parentCaseId}`
      )
    }
    let { alertEscalations } = caseEscalationRequest
    const { caseUpdateRequest } = caseEscalationRequest

    const alertIds = alertEscalations?.map((alert) => alert.alertId) || []
    const isTransactionsEscalation = alertEscalations?.some(
      (ae) => ae.transactionIds?.length ?? 0 > 0
    )

    // Hydrate escalation requests with the txn IDS if none were specified
    alertEscalations = alertEscalations?.map((alert) => {
      if (isEmpty(alert.transactionIds)) {
        return alert
      }
      alert.transactionIds = alert.transactionIds?.filter(
        (t) => !c.caseHierarchyDetails?.childTransactionIds?.includes(t)
      )

      if (alert.transactionIds?.length === 0) {
        throw new BadRequest(
          `Cannot escalate ${alert.alertId} as all of its transactions have already been escalated.`
        )
      }

      return alert
    })

    const currentTimestamp = Date.now()
    const reviewAssignments = this.getEscalationAssignments(accounts)

    const escalatedAlerts = c.alerts?.filter((alert) =>
      alertEscalations!.some(
        (alertEscalation) => alertEscalation.alertId === alert.alertId
      )
    )

    const remainingAlerts = c.alerts?.filter(
      (alert) =>
        !alertEscalations!.some(
          (alertEscalation) =>
            alertEscalation.alertId === alert.alertId &&
            // Keep the original alert if only some transactions were escalated
            (isEmpty(alertEscalation.transactionIds) ||
              alertEscalation.transactionIds?.length ===
                alert.transactionIds?.length)
        )
    )

    // if there are no remaining alerts, then we are escalating the entire case
    if (!remainingAlerts?.length && caseUpdateRequest) {
      return caseService.escalateCase(caseId, caseUpdateRequest)
    }

    if (
      isReviewRequired &&
      alertEscalations &&
      !isStatusInReview(remainingAlerts?.[0]?.alertStatus) &&
      !isTransactionsEscalation
    ) {
      await this.updateAlertsStatus(
        alertIds,
        {
          alertStatus: 'ESCALATED',
          reason: caseUpdateRequest?.reason ?? [],
          comment: caseUpdateRequest?.comment ?? '',
          files: caseUpdateRequest?.files ?? [],
          otherReason: caseUpdateRequest?.otherReason ?? '',
          priority: caseUpdateRequest?.priority,
          closeSourceCase: caseEscalationRequest.closeSourceCase,
        },
        { cascadeCaseUpdates: false }
      )

      if (caseUpdateRequest?.caseStatus) {
        await caseService.updateCasesStatus(
          [caseId],
          {
            reason: caseUpdateRequest?.reason ?? [],
            comment: caseUpdateRequest?.comment ?? '',
            files: caseUpdateRequest?.files ?? [],
            caseStatus: caseUpdateRequest?.caseStatus,
            otherReason: caseUpdateRequest?.otherReason ?? '',
            priority: caseUpdateRequest?.priority,
          },
          { filterInReview: true }
        )
      }

      return {
        assigneeIds: reviewAssignments.map((a) => a.assigneeUserId),
      }
    }

    // get the alerts that are being escalated
    const escalatedAlertsDetails = escalatedAlerts?.map(
      (escalatedAlert: Alert): Alert => {
        const lastStatusChange: CaseStatusChange = {
          userId: currentUserId!,
          caseStatus:
            isTransactionsEscalation && isReviewRequired
              ? 'IN_REVIEW_ESCALATED'
              : 'ESCALATED',
          timestamp: currentTimestamp,
          meta: {
            closeSourceCase: caseEscalationRequest.closeSourceCase,
          },
        }

        const escalationAlertReq = alertEscalations!.find(
          (alertEscalation) =>
            alertEscalation.alertId === escalatedAlert.alertId
        )

        let { transactionIds, alertId, parentAlertId } = escalatedAlert
        if (escalationAlertReq?.transactionIds?.length) {
          const childNumber = c.caseHierarchyDetails?.childCaseIds
            ? c.caseHierarchyDetails.childCaseIds.length + 1
            : 1

          // Create a new alert if some transactions were selected.
          transactionIds = escalationAlertReq.transactionIds
          alertId = `${escalatedAlert.alertId}.${childNumber}`
          parentAlertId = escalatedAlert.alertId
        }

        return {
          ...escalatedAlert,
          alertId,
          parentAlertId,
          alertStatus: lastStatusChange.caseStatus,
          reviewAssignments:
            isReviewRequired && currentUserAccount.reviewerId
              ? [
                  {
                    assignedByUserId: currentUserId!,
                    assigneeUserId: currentUserAccount.reviewerId,
                    timestamp: currentTimestamp,
                  },
                ]
              : reviewAssignments,
          statusChanges: escalatedAlert.statusChanges
            ? [...escalatedAlert.statusChanges, lastStatusChange]
            : [lastStatusChange],
          lastStatusChange,
          transactionIds,
        }
      }
    )

    // child case id is the parent case id + the number of child cases
    const childNumber = c.caseHierarchyDetails?.childCaseIds
      ? c.caseHierarchyDetails.childCaseIds.length + 1
      : 1

    const childCaseId = `${c.caseId}.${childNumber}`

    // filter out transactions that were escalated from the case
    const filteredTransactionsForNewCase = (
      await transactionsRepo.getTransactionsByIds(c.caseTransactionsIds || [])
    )?.filter((transaction) =>
      transaction.hitRules.some((ruleInstance) =>
        escalatedAlertsDetails
          ?.map((eA) => eA.ruleInstanceId)
          .includes(ruleInstance.ruleInstanceId)
      )
    )

    const filteredTransactionIdsForNewCase =
      filteredTransactionsForNewCase?.map(
        (transaction) => transaction.transactionId
      )

    // filter out transactions that will be in existing case
    const filteredTransactionsForExistingCase = (
      await transactionsRepo.getTransactionsByIds(c.caseTransactionsIds || [])
    ).filter((transaction) =>
      transaction.hitRules.some((ruleInstance) =>
        remainingAlerts
          ?.map((rA) => rA.ruleInstanceId)
          .includes(ruleInstance.ruleInstanceId)
      )
    )

    const filteredTransactionIdsForExistingCase =
      filteredTransactionsForExistingCase?.map(
        (transaction) => transaction.transactionId
      )

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { statusChanges, lastStatusChange, ...mainCaseAttributes } = c

    let childTransactionIds =
      alertEscalations?.flatMap((a) => a.transactionIds || []) || []

    if (c.caseHierarchyDetails?.childTransactionIds) {
      childTransactionIds = childTransactionIds.concat(
        c.caseHierarchyDetails?.childTransactionIds
      )
    }

    childTransactionIds = uniq(childTransactionIds)

    let caseHierarchyDetailsForOriginalCase: CaseHierarchyDetails = {
      childCaseIds: [childCaseId],
      childTransactionIds,
    }

    if (c.caseHierarchyDetails?.childCaseIds) {
      caseHierarchyDetailsForOriginalCase = {
        childCaseIds: [...c.caseHierarchyDetails.childCaseIds, childCaseId],
        childTransactionIds,
      }
    }

    const closeSourceCase =
      !isTransactionsEscalation &&
      (caseEscalationRequest.closeSourceCase ||
        escalatedAlerts?.some(
          (alert) => alert.lastStatusChange?.meta?.closeSourceCase === true
        ) ||
        false)

    const newCase: Case = {
      ...mainCaseAttributes,
      caseId: childCaseId,
      alerts: escalatedAlertsDetails,
      createdTimestamp: currentTimestamp,
      caseStatus: 'ESCALATED',
      reviewAssignments,
      caseTransactionsIds: filteredTransactionIdsForNewCase,
      caseHierarchyDetails: { parentCaseId: caseId },
      lastStatusChange: undefined,
      statusChanges: [],
      comments: [],
    }

    if (isTransactionsEscalation && isReviewRequired) {
      newCase.caseStatus = 'IN_REVIEW_ESCALATED'
    }

    const updatedExistingCase: Case = {
      ...c,
      alerts: remainingAlerts,
      caseTransactionsIds: filteredTransactionIdsForExistingCase,
      caseHierarchyDetails: caseHierarchyDetailsForOriginalCase,
    }

    if (closeSourceCase) {
      const lastStatusChange = {
        userId: currentUserId ?? '',
        timestamp: Date.now(),
        caseStatus: 'CLOSED' as const,
      }
      updatedExistingCase.lastStatusChange = lastStatusChange
      updatedExistingCase.statusChanges = [
        ...(updatedExistingCase.statusChanges ?? []),
        lastStatusChange,
      ]
      updatedExistingCase.caseStatus = 'CLOSED'
    }

    await caseRepository.addCaseMongo(omit(newCase, '_id'))
    await caseRepository.addCaseMongo(updatedExistingCase)

    await caseService.updateCasesStatus([newCase.caseId!], {
      ...caseUpdateRequest,
      caseStatus: newCase.caseStatus,
    })

    const assigneeIds = reviewAssignments
      .map((v) => v.assigneeUserId)
      .filter(Boolean)

    const updatedTransactions =
      alertEscalations?.flatMap((item) => item.transactionIds ?? []) ?? []

    if (childCaseId) {
      await this.auditLogService.handleAuditLogForCaseEscalation(
        [caseId],
        {
          ...caseUpdateRequest,
          caseStatus: 'ESCALATED',
          alertCaseId: childCaseId,
          updatedAlertIds: alertIds,
        },
        'STATUS_CHANGE'
      )
    }
    await this.auditLogService.handleAuditLogForAlertsEscalation(
      alertIds,
      {
        ...caseUpdateRequest,
        alertStatus: 'ESCALATED',
        alertCaseId: childCaseId,
        updatedTransactions,
      },
      'STATUS_CHANGE'
    )

    return { childCaseId, assigneeIds }
  }

  public async saveAlertComment(
    alertId: string,
    comment: Comment
  ): Promise<Comment> {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }

    const files = await this.copyFiles(comment.files || [])

    const savedComment = await this.alertsRepository.saveAlertComment(
      alert.caseId!,
      alertId,
      { ...comment, files }
    )

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  private async saveAlertsComment(
    alertIds: string[],
    caseIds: string[],
    comment: Comment
  ): Promise<Comment> {
    const files = await this.copyFiles(comment.files || [])

    const savedComment = await this.alertsRepository.saveAlertsComment(
      alertIds,
      caseIds,
      { ...comment, files }
    )

    return {
      ...savedComment,
      files: await this.getUpdatedFiles(savedComment.files),
    }
  }

  public async updateAlertsAssignments(
    alertIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    const timestamp = Date.now()

    assignments.forEach((a) => {
      a.timestamp = timestamp
    })

    await this.alertsRepository.updateAlertsAssignments(alertIds, assignments)
  }

  public async updateAlertsReviewAssignments(
    alertIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    const timestamp = Date.now()

    reviewAssignments.forEach((a) => {
      a.timestamp = timestamp
    })

    await this.alertsRepository.updateAlertsReviewAssignments(
      alertIds,
      reviewAssignments
    )
  }

  public async deleteAlertComment(
    alertId: string,
    commentId: string
  ): Promise<Comment> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    const comment = alert?.comments?.find(({ id }) => id === commentId) ?? null
    if (comment == null) {
      throw new NotFound(`"${commentId}" comment not found`)
    }

    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }

    if (alert.caseId == null) {
      throw new Error(`Alert case id is null`)
    }

    await this.alertsRepository.deleteAlertComment(
      alert.caseId,
      alertId,
      commentId
    )

    return comment
  }

  private getAlertStatusChangeCommentBody(
    statusUpdateRequest: AlertStatusUpdateRequest,
    currentStatus?: CaseStatus
  ): string {
    const { alertStatus, reason, otherReason, comment } = statusUpdateRequest
    const currentIsReview = isStatusInReview(currentStatus)
    const isReview = isStatusInReview(alertStatus)
    let body = `Alert status changed to ${
      isReview ? 'In Review' : capitalize(alertStatus.toLowerCase())
    }${
      isReview
        ? ' and is requested to be ' +
          capitalize(alertStatus.replace('IN_REVIEW_', '').toLowerCase())
        : ''
    }`

    if (currentIsReview) {
      if (currentStatus?.replace('IN_REVIEW_', '') === alertStatus) {
        body = `Alert is Approved and its status is changed to ${capitalize(
          alertStatus.toLowerCase()
        )}`
      } else {
        body = `Alert is Declined and its status is changed to ${capitalize(
          alertStatus.toLowerCase()
        )}`
      }
    }

    const allReasons = [
      ...(reason?.filter((x) => x !== 'Other') ?? []),
      ...(reason?.includes('Other') && otherReason ? [otherReason] : []),
    ]

    if (allReasons.length > 0) {
      body += `. Reasons: ${allReasons.join(', ')}`
    }

    if (comment) {
      body += `\n${comment}`
    }

    return body
  }

  public async updateAlertsStatus(
    alertIds: string[],
    statusUpdateRequest: AlertStatusUpdateRequest,
    options?: {
      bySystem?: boolean
      cascadeCaseUpdates?: boolean
      skipReview?: boolean
      account?: Account
      updateChecklistStatus?: boolean
    }
  ): Promise<void> {
    const {
      bySystem,
      cascadeCaseUpdates = true,
      skipReview = false,
      account,
      updateChecklistStatus = true,
    } = options ?? {}
    const userId = getContext()?.user?.id
    const statusChange: CaseStatusChange = {
      userId: bySystem
        ? FLAGRIGHT_SYSTEM_USER
        : userId ?? FLAGRIGHT_SYSTEM_USER,
      timestamp: Date.now(),
      reason: statusUpdateRequest.reason,
      caseStatus: statusUpdateRequest.alertStatus,
      otherReason: statusUpdateRequest.otherReason,
      meta: {
        closeSourceCase: statusUpdateRequest.closeSourceCase,
      },
    }

    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    const accountsService = new AccountsService(
      { auth0Domain: process.env.AUTH0_DOMAIN as string },
      { mongoDb: this.mongoDb }
    )

    const userAccount = account ?? (await accountsService.getAccount(userId!))

    if (userAccount == null) {
      throw new Error(`User account not found`)
    }
    let isReview = false

    const [alerts, cases] = await Promise.all([
      this.alertsRepository.getAlertsByIds(alertIds),
      caseRepository.getCasesByAlertIds(alertIds),
    ])

    const alertsNotFound = alertIds.filter(
      (alertId) => !alerts.find((alert) => alert?.alertId === alertId)
    )

    if (alertsNotFound.length) {
      throw new NotFound(`Alerts not found: ${alertsNotFound.join(', ')}`)
    }

    const isInProgressOrOnHold =
      statusUpdateRequest.alertStatus.endsWith('ON_HOLD') ||
      statusUpdateRequest.alertStatus.endsWith('IN_PROGRESS')

    const isLastInReview = isStatusInReview(alerts[0]?.alertStatus)

    if (
      userAccount.reviewerId &&
      !isInProgressOrOnHold &&
      !skipReview &&
      !isLastInReview &&
      hasFeature('ADVANCED_WORKFLOWS')
    ) {
      if (!userAccount.reviewerId) {
        throw new Error(`User account reviewerId is null`)
      }
      const caseStatusToChange = statusChange.caseStatus?.replace(
        'IN_REVIEW_',
        ''
      )

      statusChange.caseStatus = `IN_REVIEW_${caseStatusToChange}` as CaseStatus
      statusUpdateRequest.alertStatus =
        `IN_REVIEW_${caseStatusToChange}` as CaseStatus

      isReview = true
    }

    const caseIds = cases.map((c) => c.caseId!)
    const commentBody = this.getAlertStatusChangeCommentBody(
      statusUpdateRequest,
      alerts[0]?.alertStatus
    )

    const caseService = new CaseService(caseRepository, this.s3, this.s3Config)
    const alertsWithPreviousEscalations = alerts.filter(
      (alert) =>
        alert.alertStatus === 'ESCALATED' ||
        alert.alertStatus === 'IN_REVIEW_ESCALATED'
    )

    await withTransaction(async () => {
      const [response] = await Promise.all([
        this.alertsRepository.updateAlertsStatus(
          alertIds,
          caseIds,
          statusChange
        ),
        this.saveAlertsComment(alertIds, caseIds, {
          userId: statusChange.userId,
          body: commentBody,
          files: statusUpdateRequest.files,
        }),
        ...(isReview && userAccount.reviewerId && !skipReview
          ? [
              this.alertsRepository.updateInReviewAssignemnts(
                alertIds,
                [
                  {
                    assigneeUserId: userId!,
                    assignedByUserId: FLAGRIGHT_SYSTEM_USER,
                    timestamp: Date.now(),
                  },
                ],
                [
                  {
                    assigneeUserId: userAccount.reviewerId,
                    assignedByUserId: userId!,
                    timestamp: Date.now(),
                  },
                ]
              ),
            ]
          : []),
        ...(hasFeature('ADVANCED_WORKFLOWS') &&
        alertsWithPreviousEscalations.length &&
        statusUpdateRequest?.alertStatus === 'CLOSED'
          ? [
              this.alertsRepository.updateReviewAssignmentsToAssignments(
                alertsWithPreviousEscalations.map((alert) => alert.alertId!)
              ),
            ]
          : []),
        ...(statusUpdateRequest?.alertStatus === 'CLOSED' &&
        updateChecklistStatus &&
        hasFeature('QA')
          ? [this.alertsRepository.markAllChecklistItemsAsDone(alertIds)]
          : []),
      ])

      const caseIdsWithAllAlertsSameStatus =
        response.caseIdsWithAllAlertsSameStatus

      if (
        caseIdsWithAllAlertsSameStatus.length &&
        cascadeCaseUpdates &&
        response.caseStatusToChange &&
        !isInProgressOrOnHold
      ) {
        const otherReason = `All alerts of this case are ${startCase(
          toLower(response?.caseStatusToChange ?? '')
        )}`

        const caseUpdateStatus: CaseStatusUpdate = {
          caseStatus: response.caseStatusToChange,
          reason: ['Other'],
          comment: statusUpdateRequest.comment,
          otherReason,
          files: statusUpdateRequest.files,
        }
        await Promise.all([
          caseService.updateCasesStatus(
            caseIdsWithAllAlertsSameStatus,
            caseUpdateStatus,
            {
              bySystem: true,
              cascadeAlertsUpdate: false,
              account: userAccount,
              updateChecklistStatus: false,
            }
          ),
          this.auditLogService.handleAuditLogForCaseUpdate(
            caseIdsWithAllAlertsSameStatus,
            caseUpdateStatus,
            'STATUS_CHANGE'
          ),
        ])
      }

      if (
        statusUpdateRequest.alertStatus === 'CLOSED' &&
        hasFeature('SANCTIONS')
      ) {
        await Promise.all(
          alertIds.map(async (alertId) => {
            const alert = alerts.find((alert) => alert.alertId === alertId)
            const c = cases.find((c) => c.caseId === alert?.caseId)
            if (!c || !alert) {
              return
            }
            const userId =
              c.caseUsers?.origin?.userId ?? c.caseUsers?.destination?.userId
            if (userId) {
              await this.whiltelistSanctionEntities(userId, [alert])
            }
          })
        )
      }
    })

    if (statusUpdateRequest.alertStatus === 'CLOSED') {
      await this.sendAlertClosedWebhook(alertIds, cases, statusUpdateRequest)
    }
  }

  private async sendAlertClosedWebhook(
    alertIds: string[],
    cases: Case[],
    statusUpdateRequest: AlertStatusUpdateRequest
  ) {
    const { reason, otherReason } = statusUpdateRequest
    const commentBody =
      this.getAlertStatusChangeCommentBody(statusUpdateRequest)

    const webhookTasks: ThinWebhookDeliveryTask<AlertClosedDetails>[] = []

    for (const alertId of alertIds) {
      const case_ = cases.find((c) =>
        c.alerts?.some((a) => a.alertId === alertId)
      )

      const alert = case_?.alerts?.find((a) => a.alertId === alertId)

      if (alert) {
        webhookTasks.push({
          event: 'ALERT_CLOSED',
          triggeredBy: 'MANUAL',
          payload: {
            alertId,
            reasons: reason,
            reasonDescriptionForOther: otherReason,
            comment: commentBody,
            ruleId: alert.ruleId,
            ruleInstanceId: alert.ruleInstanceId,
            ruleName: alert.ruleName,
            ruleDescription: alert.ruleDescription,
            userId:
              case_?.caseUsers?.origin?.userId ??
              case_?.caseUsers?.destination?.userId,
            transactionIds: alert.transactionIds,
          },
        })
      }
    }

    await sendWebhookTasks<AlertClosedDetails>(this.tenantId, webhookTasks)
  }

  public async getAlertTransactions(
    alertId: string,
    params: OptionalPagination<DefaultApiGetAlertTransactionListRequest>
  ): Promise<CursorPaginationResponse<InternalTransaction>> {
    return await this.alertsRepository.getAlertTransactionsHit({
      alertId,
      pageSize: params?.pageSize,
      userId: params?.userId,
      originUserId: params?.originUserId,
      destinationUserId: params?.destinationUserId,
      start: params?.start,
      sortOrder: params?.sortOrder,
      sortField: params?.sortField,
      filterOriginPaymentMethodId: params?.filterOriginPaymentMethodId,
      filterDestinationPaymentMethodId:
        params?.filterDestinationPaymentMethodId,
      filterTransactionId: params?.filterTransactionId,
      filterTransactionType: params?.filterTransactionType,
      filterOriginPaymentMethods: params?.filterOriginPaymentMethods,
      filterDestinationPaymentMethods: params?.filterDestinationPaymentMethods,
      filterDestinationCurrencies: params?.filterDestinationCurrencies,
      filterOriginCurrencies: params?.filterOriginCurrencies,
      beforeTimestamp: params?.beforeTimestamp,
      afterTimestamp: params?.afterTimestamp,
    })
  }

  public async whiltelistSanctionEntities(userId: string, alerts: Alert[]) {
    const sanctionsService = new SanctionsService(this.tenantId)
    const searchIds = alerts
      .flatMap((alert) =>
        alert.ruleHitMeta?.sanctionsDetails?.map((v) => v.searchId)
      )
      .filter(Boolean) as string[]
    if (searchIds.length === 0) {
      return
    }

    const searchs = await sanctionsService.getSearchHistoriesByIds(searchIds)
    const entities = searchs
      .flatMap((search) => search?.response?.data)
      .map((v) => v?.doc)
      .filter(Boolean) as ComplyAdvantageSearchHitDoc[]
    await sanctionsService.addWhitelistEntities(entities, userId)
  }

  async updateAlertChecklistStatus(
    alertId: string,
    checklistItemIds: string[],
    done: ChecklistDoneStatus
  ): Promise<void> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    if (!alert) {
      throw new NotFound('No alert')
    }
    if (!alert.ruleChecklistTemplateId) {
      throw new NotFound('Alert has no checklist')
    }
    const originalChecklist = cloneDeep(alert.ruleChecklist)
    const updatedChecklist = alert.ruleChecklist?.map((checkListItem) => {
      if (
        checkListItem.checklistItemId &&
        checklistItemIds.includes(checkListItem.checklistItemId)
      ) {
        checkListItem.done = done
      }
      return checkListItem
    })
    if (isEqual(originalChecklist, updatedChecklist)) {
      return // No changes made to the checklist
    }
    alert.ruleChecklist = updatedChecklist
    await this.alertsRepository.saveAlert(alert.caseId!, alert)
    await this.auditLogService.handleAuditLogForChecklistUpdate(
      alertId,
      originalChecklist,
      updatedChecklist
    )
  }

  async updateAlertChecklistQaStatus(
    alertId: string,
    checklistItemIds: string[],
    status: ChecklistStatus
  ): Promise<void> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    if (!alert) {
      throw new NotFound('No alert')
    }
    if (!alert.ruleChecklistTemplateId) {
      throw new NotFound('Alert has no checklist')
    }
    const originalChecklist = cloneDeep(alert.ruleChecklist)
    const updatedChecklist = alert.ruleChecklist?.map((checkListItem) => {
      if (
        checkListItem.checklistItemId &&
        checklistItemIds.includes(checkListItem.checklistItemId)
      ) {
        checkListItem.status = status
      }
      return checkListItem
    })
    if (isEqual(originalChecklist, updatedChecklist)) {
      return // No changes made to the checklist
    }

    alert.ruleChecklist = updatedChecklist

    await Promise.all([
      this.alertsRepository.saveAlert(alert.caseId!, alert),
      this.auditLogService.handleAuditLogForChecklistUpdate(
        alertId,
        originalChecklist,
        updatedChecklist
      ),
    ])
  }

  private async acceptanceCriteriaPassed(alert: Alert): Promise<boolean> {
    const ruleChecklistTemplateId = alert.ruleChecklistTemplateId
    if (!ruleChecklistTemplateId) {
      throw new BadRequest('No checklist for alert')
    }
    const checklistTemplate =
      await this.checklistTemplateService().getChecklistTemplate(
        ruleChecklistTemplateId
      )

    if (!checklistTemplate) {
      throw new NotFound('Checklist template not found')
    }

    const p1FailedAllowed =
      checklistTemplate.qaPassCriteria?.p1Errors ?? Number.MAX_SAFE_INTEGER
    const p2FailedAllowed =
      checklistTemplate.qaPassCriteria?.p2Errors ?? Number.MAX_SAFE_INTEGER
    let p1sFailed = 0
    let p2sFailed = 0
    checklistTemplate.categories.forEach((category) => {
      category.checklistItems.forEach((checklistItem) => {
        const alertChecklistItem = alert.ruleChecklist?.find(
          (rcli) => rcli.checklistItemId === checklistItem.id
        )
        if (!alertChecklistItem || alertChecklistItem.status === 'FAILED') {
          if (checklistItem.level === 'P1') {
            p1sFailed++
          }
          if (checklistItem.level === 'P2') {
            p2sFailed++
          }
        }
      })
    })

    return p1sFailed <= p1FailedAllowed && p2sFailed <= p2FailedAllowed
  }

  private checklistTemplateService(): ChecklistTemplatesService {
    return new ChecklistTemplatesService(this.tenantId, this.mongoDb)
  }

  async updateAlertQaStatus(
    userId: string,
    update: AlertQaStatusUpdateRequest
  ): Promise<void> {
    const alerts = await this.alertsRepository.getAlertsByIds(update.alertIds)
    await Promise.all(
      alerts.map(async (alert) => {
        if (update.checklistStatus === 'FAILED') {
          // Find who closed the alert and reassign them
          const originalAssignee = alert.statusChanges
            ?.slice()
            .reverse()
            .find((sc) => sc.caseStatus === 'CLOSED')?.userId
          if (originalAssignee) {
            alert.assignments = [
              {
                assigneeUserId: originalAssignee,
                assignedByUserId: userId,
                timestamp: Date.now(),
              },
            ]
          }
        }
        alert.ruleQaStatus = update.checklistStatus
        if (!alert.comments) {
          alert.comments = []
        }
        if (!alert.statusChanges) {
          alert.statusChanges = []
        }
        alert.comments?.push({
          body: `Alert QA status set to ${update.checklistStatus} with comment: ${update.comment}`,
          createdAt: Date.now(),
          files: update.files,
          id: uuid4(),
          updatedAt: Date.now(),
          userId,
        })
        alert.statusChanges?.push({
          caseStatus: 'REOPENED',
          comment: update.comment,
          otherReason: update.otherReason,
          reason: update.reason,
          timestamp: Date.now(),
          userId,
        })

        const acceptanceCriteriaPassed =
          update.checklistStatus === 'PASSED'
            ? await this.acceptanceCriteriaPassed(alert)
            : true

        if (!acceptanceCriteriaPassed) {
          throw new BadRequest(`Acceptance criteria not passed for alert`)
        }

        await Promise.all([
          this.alertsRepository.saveAlert(alert.caseId!, alert),
          this.auditLogService.handleAuditLogForAlertQaUpdate(
            alert.alertId as string,
            update
          ),
        ])
      })
    )
  }

  async updateAlertsQaAssignments(
    alertId: string,
    assignments: Assignment[]
  ): Promise<void> {
    const alert = await this.alertsRepository.getAlertById(alertId)
    if (!alert) {
      throw new NotFound('No alert')
    }

    alert.qaAssignment = assignments
    await this.alertsRepository.saveAlert(alert.caseId!, alert)
  }
}
