import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3 } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { BadRequest, Forbidden, NotFound } from 'http-errors'
import {
  capitalize,
  compact,
  isEmpty,
  omit,
  startCase,
  toLower,
  uniq,
} from 'lodash'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import {
  AlertsRepository,
  FLAGRIGHT_SYSTEM_USER,
} from '../rules-engine/repositories/alerts-repository'
import { CaseAlertsCommonService, S3Config } from '../case-alerts-common'
import { CaseRepository } from '../rules-engine/repositories/case-repository'
import { sendWebhookTasks, ThinWebhookDeliveryTask } from '../webhook/utils'
import { SanctionsService } from '../sanctions'
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
import { getMongoDbClient, withTransaction } from '@/utils/mongoDBUtils'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { getS3ClientByEvent } from '@/utils/s3'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { isStatusInReview } from '@/utils/helpers'

@traceable
export class AlertsService extends CaseAlertsCommonService {
  alertsRepository: AlertsRepository
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
    params: DefaultApiGetAlertListRequest
  ): Promise<AlertListResponse> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Alerts Query'
    )

    try {
      return await this.alertsRepository.getAlerts(params)
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

  public async escalateAlerts(
    caseId: string,
    caseEscalationRequest: CaseEscalationRequest
  ): Promise<{ childCaseId?: string; assigneeIds: string[] }> {
    const accountsService = new AccountsService(
      { auth0Domain: process.env.AUTH0_DOMAIN as string },
      { mongoDb: this.mongoDb }
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

    const isTransactionsEscalation = alertEscalations?.some(
      (ae) => ae.transactionIds?.length ?? 0 > 0
    )

    // Hydrate escalation requests with the txn IDS if none were specified
    alertEscalations = alertEscalations?.map((ae) => {
      if (isEmpty(ae.transactionIds)) {
        return ae
      }
      ae.transactionIds = ae.transactionIds?.filter(
        (t) => !c.caseHierarchyDetails?.childTransactionIds?.includes(t)
      )

      if (ae.transactionIds?.length === 0) {
        throw new BadRequest(
          `Cannot escalate ${ae.alertId} as all of its transactions have already been escalated.`
        )
      }

      return ae
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
      !isTransactionsEscalation &&
      hasFeature('ESCALATION')
    ) {
      await this.updateAlertsStatus(
        alertEscalations.map((ae) => ae.alertId),
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
    const filteredTransactionsForNewCase = c.caseTransactions?.filter(
      (transaction) =>
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
    const filteredTransactionsForExistingCase = c.caseTransactions?.filter(
      (transaction) =>
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
      caseTransactions: filteredTransactionsForNewCase,
      caseTransactionsIds: filteredTransactionIdsForNewCase,
      caseHierarchyDetails: { parentCaseId: caseId },
    }

    if (isTransactionsEscalation && isReviewRequired) {
      newCase.caseStatus = 'IN_REVIEW_ESCALATED'
    }

    const updatedExistingCase: Case = {
      ...c,
      alerts: remainingAlerts,
      caseTransactions: filteredTransactionsForExistingCase,
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

    if (caseUpdateRequest && caseUpdateRequest.caseStatus) {
      if (!isTransactionsEscalation) {
        await caseService.updateCaseForEscalation(caseId, {
          ...caseUpdateRequest,
          comment: caseUpdateRequest.comment,
        })
      } else {
        await this.updateAlertsStatus(
          compact(escalatedAlerts?.map((alert) => alert.alertId)),
          {
            alertStatus: caseUpdateRequest.caseStatus,
            comment: caseUpdateRequest.comment,
            reason: caseUpdateRequest.reason,
            files: caseUpdateRequest.files,
            otherReason: caseUpdateRequest.otherReason,
            priority: caseUpdateRequest.priority,
            closeSourceCase: caseEscalationRequest.closeSourceCase,
          }
        )
      }
    }

    const assigneeIds = reviewAssignments
      .map((v) => v.assigneeUserId)
      .filter(Boolean)

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
      cascadeCaseUpdates?: boolean
      skipReview?: boolean
      account?: Account
    }
  ): Promise<void> {
    const {
      cascadeCaseUpdates = true,
      skipReview = false,
      account,
    } = options ?? {}
    const userId = getContext()?.user?.id
    const statusChange: CaseStatusChange = {
      userId: !cascadeCaseUpdates ? FLAGRIGHT_SYSTEM_USER : userId!,
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

    const alerts = await this.alertsRepository.getAlertsByIds(alertIds)

    const isInProgressOrOnHold =
      statusUpdateRequest.alertStatus.endsWith('ON_HOLD') ||
      statusUpdateRequest.alertStatus.endsWith('IN_PROGRESS')

    const isLastInReview = isStatusInReview(alerts[0]?.alertStatus)

    if (
      userAccount.reviewerId &&
      !isInProgressOrOnHold &&
      !skipReview &&
      !isLastInReview &&
      hasFeature('ESCALATION')
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

    const cases = await caseRepository.getCasesByAlertIds(alertIds)

    const caseIds = cases.map((c) => c.caseId!)
    const commentBody = this.getAlertStatusChangeCommentBody(
      statusUpdateRequest,
      alerts[0]?.alertStatus
    )

    const casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      this.tenantId,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )

    const caseService = new CaseService(caseRepository, this.s3, this.s3Config)

    await withTransaction(async () => {
      const [response] = await Promise.all([
        this.alertsRepository.updateAlertsStatus(
          alertIds,
          caseIds,
          statusChange
        ),
        this.saveAlertsComment(alertIds, caseIds, {
          userId: cascadeCaseUpdates ? userId : FLAGRIGHT_SYSTEM_USER,
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

        await caseService.updateCasesStatus(
          caseIdsWithAllAlertsSameStatus,
          caseUpdateStatus,
          { cascadeAlertsUpdate: false, account: userAccount }
        )

        await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
          caseIdsWithAllAlertsSameStatus,
          caseUpdateStatus
        )
      }

      if (
        statusUpdateRequest.alertStatus === 'CLOSED' &&
        hasFeature('SANCTIONS')
      ) {
        await Promise.all(
          alertIds.map(async (alertId) => {
            const alert = await this.getAlert(alertId)
            if (!alert) {
              return
            }
            const c = await caseService.getCase(alert.caseId!)
            const userId =
              c?.caseUsers?.origin?.userId ?? c?.caseUsers?.destination?.userId
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

    const searchs = await sanctionsService.getSearchHistoriesByIds(searchIds)
    const entities = searchs
      .flatMap((search) => search?.response?.data)
      .map((v) => v?.doc)
      .filter(Boolean) as ComplyAdvantageSearchHitDoc[]
    await sanctionsService.addWhitelistEntities(entities, userId)
  }
}
