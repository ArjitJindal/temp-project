import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { NotFound, BadRequest } from 'http-errors'
import _ from 'lodash'
import { AlertsRepository } from '../rules-engine/repositories/alerts-repository'
import { CaseAlertsCommonService, S3Config } from '../case-alerts-common'
import { CaseRepository } from '../rules-engine/repositories/case-repository'
import { sendWebhookTasks } from '../webhook/utils'
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
import { getContext } from '@/core/utils/context'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { Comment } from '@/@types/openapi-internal/Comment'
import { CaseHierarchyDetails } from '@/@types/openapi-internal/CaseHierarchyDetails'
import { AlertUpdateRequest } from '@/@types/openapi-internal/AlertUpdateRequest'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { AlertClosedDetails } from '@/@types/openapi-public/AlertClosedDetails'
import { OptionalPagination } from '@/utils/pagination'
import { TransactionsListResponse } from '@/@types/openapi-internal/TransactionsListResponse'

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
      return await this.alertsRepository.getAlertById(alertId)
    } finally {
      caseGetSegment?.close()
    }
  }

  public async escalateAlerts(
    caseId: string,
    caseEscalationRequest: CaseEscalationRequest,
    accounts: Account[]
  ): Promise<string> {
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

    const escalatedAlerts = c.alerts
      ?.filter((alert) =>
        alertEscalations!.some(
          (alertEscalation) => alertEscalation.alertId === alert.alertId
        )
      )
      .map((escalatedAlert: Alert): Alert => {
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
          reviewAssignments: [this.getEscalationAssignment(accounts)],
          statusChanges: escalatedAlert.statusChanges
            ? [...escalatedAlert.statusChanges, lastStatusChange]
            : [lastStatusChange],
          lastStatusChange: lastStatusChange,
          transactionIds,
        }
      })

    const remainingAlerts = c.alerts?.filter(
      (alert) =>
        !alertEscalations!.some(
          (alertEscalation) =>
            alertEscalation.alertId === alert.alertId &&
            // Keep the original alert if only some transactions were escalated
            (!alertEscalation.transactionIds ||
              alertEscalation.transactionIds?.length ===
                alert.transactionIds?.length)
        )
    )

    if (!remainingAlerts?.length && caseUpdateRequest) {
      await caseService.escalateCase(caseId, caseUpdateRequest, accounts)
      return caseId
    }

    const childNumber = c.caseHierarchyDetails?.childCaseIds
      ? c.caseHierarchyDetails.childCaseIds.length + 1
      : 1
    const childCaseId = `${c.caseId}.${childNumber}`

    const filteredTransactionsForNewCase = c.caseTransactions?.filter(
      (transaction) =>
        transaction.hitRules.some((ruleInstance) =>
          escalatedAlerts
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
      _id: c._id! + parseFloat(`0.${childNumber}`),
      caseId: childCaseId,
      alerts: escalatedAlerts,
      createdTimestamp: currentTimestamp,
      caseStatus: 'ESCALATED',
      reviewAssignments: [this.getEscalationAssignment(accounts)],
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

    await caseRepository.addCaseMongo(newCase)
    await caseRepository.addCaseMongo(updatedExistingCase)
    if (caseUpdateRequest) {
      await caseService.updateCases(
        (getContext()?.user as Account).id,
        [caseId],
        {
          ...caseUpdateRequest,
          comment: `Alert(s) ${escalatedAlerts!
            .map((alert) => alert.alertId)
            .join(', ')} ESCALATED by: ${
            (getContext()?.user as Account).name
          }. ${caseUpdateRequest.comment}`,
        }
      )
    }

    return childCaseId
  }

  public async saveAlertComment(
    alertId: string,
    comment: Comment
  ): Promise<Comment> {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }

    if (alert.caseId == null) {
      throw new Error(`Alert case id is null`)
    }

    const files = await this.copyFiles(comment.files || [])

    const savedComment = await this.alertsRepository.saveAlertComment(
      alert.caseId,
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

  public async deleteAlertComment(
    alertId: string,
    commentId: string
  ): Promise<void> {
    const alert = await this.alertsRepository.getAlertById(alertId)

    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }

    if (alert.caseId == null) {
      throw new Error(`Alert case id is null`)
    }

    const comment = alert.comments?.find(({ id }) => id === commentId) ?? null

    if (comment == null) {
      throw new NotFound(`"${commentId}" comment not found`)
    }

    await this.alertsRepository.deleteAlertComment(
      alert.caseId,
      alertId,
      commentId
    )
  }

  public async updateAlerts(
    userId: string,
    alertIds: string[],
    updateRequest: AlertUpdateRequest
  ) {
    const caseRepository = new CaseRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    const statusChange: CaseStatusChange | undefined =
      updateRequest.alertStatus && {
        userId,
        timestamp: Date.now(),
        reason: updateRequest.reason,
        caseStatus: updateRequest.alertStatus,
        otherReason: updateRequest.otherReason,
      }

    await this.alertsRepository.updateAlerts(alertIds, {
      assignments: updateRequest.assignments,
      statusChange: statusChange,
    })

    if (updateRequest.alertStatus) {
      let body = `Alert status changed to ${updateRequest.alertStatus}`
      const allReasons = [
        ...(updateRequest?.reason?.filter((x) => x !== 'Other') ?? []),
        ...(updateRequest?.reason?.includes('Other') &&
        updateRequest.otherReason
          ? [updateRequest.otherReason]
          : []),
      ]

      if (allReasons.length > 0) {
        body += `. Reasons: ${allReasons.join(', ')}`
      }

      if (updateRequest.comment) {
        body += `. ${updateRequest.comment}`
      }

      const cases = await caseRepository.getCasesByAlertIds(alertIds)

      await Promise.all(
        alertIds.map((alertId) => {
          this.saveAlertComment(alertId, {
            userId,
            body: body,
            files: updateRequest.files,
          })
          const case_ = cases.find((c) =>
            c.alerts.find((a) => a.alertId === alertId)
          )
          const alert = case_?.alerts.find((a) => a.alertId === alertId)
          updateRequest.alertStatus === 'CLOSED' &&
            sendWebhookTasks(this.tenantId, [
              {
                event: 'ALERT_CLOSED',
                payload: {
                  alertId,
                  reasons: updateRequest.reason,
                  reasonDescriptionForOther: updateRequest.otherReason,
                  comment: updateRequest.comment,
                  ruleId: alert?.ruleId,
                  ruleInstanceId: alert?.ruleInstanceId,
                  ruleName: alert?.ruleName,
                  ruleDescription: alert?.ruleDescription,
                  userId:
                    case_?.caseUsers?.origin?.userId ??
                    case_?.caseUsers?.destination?.userId,
                  transactionIds: alert?.transactionIds,
                } as AlertClosedDetails,
              },
            ])
        })
      )
    }
    return 'OK'
  }

  public async getAlertTransactions(
    alertId: string,
    params: OptionalPagination<DefaultApiGetAlertTransactionListRequest>
  ): Promise<TransactionsListResponse> {
    if (!params?.showExecutedTransactions) {
      return await this.alertsRepository.getAlertTransactionsHit(alertId, {
        page: params?.page,
        pageSize: params?.pageSize,
      })
    } else {
      return await this.alertsRepository.getAlertTransactionsExecuted(
        alertId,
        params
      )
    }
  }
}
