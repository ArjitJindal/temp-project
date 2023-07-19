import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import _ from 'lodash'
import {
  AlertsRepository,
  FLAGRIGHT_SYSTEM_USER,
} from '../rules-engine/repositories/alerts-repository'
import { CaseAlertsCommonService, S3Config } from '../case-alerts-common'
import { CaseRepository } from '../rules-engine/repositories/case-repository'
import { ThinWebhookDeliveryTask, sendWebhookTasks } from '../webhook/utils'
import { SanctionsService } from '../sanctions'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { Alert } from '@/@types/openapi-internal/Alert'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetAlertTransactionListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { addNewSubsegment } from '@/core/xray'
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
import { withTransaction } from '@/utils/mongoDBUtils'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { ComplyAdvantageSearchHitDoc } from '@/@types/openapi-internal/ComplyAdvantageSearchHitDoc'

export class AlertsService extends CaseAlertsCommonService {
  alertsRepository: AlertsRepository
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    alertsRepository: AlertsRepository,
    s3: AWS.S3,
    s3Config: S3Config
  ) {
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
      alert.comments = alert?.comments?.map((c) => {
        if (!c.files) {
          return c
        }
        const files = c.files?.map((f) => {
          return {
            ...f,
            downloadLink: this.getDownloadLink(f),
          }
        })
        return {
          ...c,
          files,
        }
      })
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
      if (_.isEmpty(ae.transactionIds)) {
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

    const updatingUserId = (getContext()?.user as Account).id
    const currentTimestamp = Date.now()
    const reviewAssignments = this.getEscalationAssignments(accounts)
    const escalatedAlerts = c.alerts?.filter((alert) =>
      alertEscalations!.some(
        (alertEscalation) => alertEscalation.alertId === alert.alertId
      )
    )

    const escalatedAlertsDetails = escalatedAlerts?.map(
      (escalatedAlert: Alert): Alert => {
        const lastStatusChange = {
          userId: updatingUserId,
          caseStatus: 'ESCALATED' as CaseStatus,
          timestamp: currentTimestamp,
        }

        const escalationAlertReq = alertEscalations!.find(
          (alertEscalation) =>
            alertEscalation.alertId === escalatedAlert.alertId
        )

        let transactionIds = escalatedAlert.transactionIds
        let alertId = escalatedAlert.alertId
        let parentAlertId
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
          alertStatus: 'ESCALATED',
          reviewAssignments,
          statusChanges: escalatedAlert.statusChanges
            ? [...escalatedAlert.statusChanges, lastStatusChange]
            : [lastStatusChange],
          lastStatusChange: lastStatusChange,
          transactionIds,
        }
      }
    )

    const remainingAlerts = c.alerts?.filter(
      (alert) =>
        !alertEscalations!.some(
          (alertEscalation) =>
            alertEscalation.alertId === alert.alertId &&
            // Keep the original alert if only some transactions were escalated
            (_.isEmpty(alertEscalation.transactionIds) ||
              alertEscalation.transactionIds?.length ===
                alert.transactionIds?.length)
        )
    )

    if (!remainingAlerts?.length && caseUpdateRequest) {
      return caseService.escalateCase(caseId, caseUpdateRequest)
    }

    const childNumber = c.caseHierarchyDetails?.childCaseIds
      ? c.caseHierarchyDetails.childCaseIds.length + 1
      : 1
    const childCaseId = `${c.caseId}.${childNumber}`

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
    childTransactionIds = _.uniq(childTransactionIds)

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

    const updatedExistingCase: Case = {
      ...c,
      alerts: remainingAlerts,
      caseTransactions: filteredTransactionsForExistingCase,
      caseTransactionsIds: filteredTransactionIdsForExistingCase,
      caseHierarchyDetails: caseHierarchyDetailsForOriginalCase,
    }

    await caseRepository.addCaseMongo(_.omit(newCase, '_id'))
    await caseRepository.addCaseMongo(updatedExistingCase)

    if (caseUpdateRequest && caseUpdateRequest.caseStatus) {
      if (!isTransactionsEscalation) {
        await caseService.updateCaseForEscalation(caseId, {
          ...caseUpdateRequest,
          comment: caseUpdateRequest.comment,
        })
      } else {
        await this.updateAlertsStatus(
          _.compact(escalatedAlerts?.map((alert) => alert.alertId)),
          {
            alertStatus: caseUpdateRequest.caseStatus,
            comment: caseUpdateRequest.comment,
            reason: caseUpdateRequest.reason,
            files: caseUpdateRequest.files,
            otherReason: caseUpdateRequest.otherReason,
            priority: caseUpdateRequest.priority,
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
      files: savedComment.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
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
      files: savedComment.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
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
    statusUpdateRequest: AlertStatusUpdateRequest
  ): string {
    const { alertStatus, reason, otherReason, comment } = statusUpdateRequest
    let body = `Alert status changed to ${alertStatus}`
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
    options?: { cascadeCaseUpdates?: boolean }
  ): Promise<void> {
    const { cascadeCaseUpdates = true } = options ?? {}
    const userId = getContext()?.user?.id
    const statusChange: CaseStatusChange = {
      userId: cascadeCaseUpdates ? FLAGRIGHT_SYSTEM_USER : userId!,
      timestamp: Date.now(),
      reason: statusUpdateRequest.reason,
      caseStatus: statusUpdateRequest.alertStatus,
      otherReason: statusUpdateRequest.otherReason,
    }

    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    const cases = await caseRepository.getCasesByAlertIds(alertIds)

    const caseIds = cases.map((c) => c.caseId!)

    const commentBody =
      this.getAlertStatusChangeCommentBody(statusUpdateRequest)

    const casesAlertsAuditLogService = new CasesAlertsAuditLogService(
      this.tenantId,
      { mongoDb: this.mongoDb, dynamoDb: this.dynamoDb }
    )

    const caseService = new CaseService(caseRepository, this.s3, this.s3Config)

    await withTransaction(async () => {
      const [response, _] = await Promise.all([
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
      ])

      const caseIdsWithAllAlertsClosed = response.caseIdsWithAllAlertsClosed

      if (caseIdsWithAllAlertsClosed.length && cascadeCaseUpdates) {
        const caseUpdateStatus: CaseStatusUpdate = {
          caseStatus: 'CLOSED',
          reason: ['Other'],
          comment: statusUpdateRequest.comment,
          otherReason: 'All alerts of this case are closed',
          files: statusUpdateRequest.files,
        }
        await caseService.updateCasesStatus(
          caseIdsWithAllAlertsClosed,
          caseUpdateStatus,
          { cascadeAlertsUpdate: false }
        )

        await casesAlertsAuditLogService.handleAuditLogForCaseUpdate(
          caseIdsWithAllAlertsClosed,
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

    const webhookTasks: ThinWebhookDeliveryTask[] = []

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
          } as AlertClosedDetails,
        })
      }
    }

    await sendWebhookTasks(this.tenantId, webhookTasks)
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
      _from: params?._from,
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
