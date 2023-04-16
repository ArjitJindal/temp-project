import * as createError from 'http-errors'
import { NotFound, BadRequest } from 'http-errors'
import _ from 'lodash'
import { Comment } from '@/@types/openapi-internal/Comment'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import {
  DefaultApiGetAlertListRequest,
  DefaultApiGetCaseListRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { AlertListResponse } from '@/@types/openapi-internal/AlertListResponse'
import { CasesListResponse } from '@/@types/openapi-internal/CasesListResponse'
import { CaseUpdateRequest } from '@/@types/openapi-internal/CaseUpdateRequest'
import { Alert } from '@/@types/openapi-internal/Alert'
import { AlertUpdateRequest } from '@/@types/openapi-internal/AlertUpdateRequest'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { TransactionUpdateRequest } from '@/@types/openapi-internal/TransactionUpdateRequest'
import { TransactionsListResponse } from '@/@types/openapi-internal/TransactionsListResponse'
import { RulesHitPerCase } from '@/@types/openapi-internal/RulesHitPerCase'
import { PaginationParams } from '@/utils/pagination'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { addNewSubsegment } from '@/core/xray'
import { sendWebhookTasks } from '@/services/webhook/utils'
import { getContext } from '@/core/utils/context'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseEscalationRequest } from '@/@types/openapi-internal/CaseEscalationRequest'
import { CaseHierarchyDetails } from '@/@types/openapi-internal/CaseHierarchyDetails'

export class CaseService {
  caseRepository: CaseRepository
  dashboardStatsRepository: DashboardStatsRepository
  s3: AWS.S3
  documentBucketName: string
  tmpBucketName: string

  constructor(
    caseRepository: CaseRepository,
    dashboardStatsRepository: DashboardStatsRepository,
    s3: AWS.S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.caseRepository = caseRepository
    this.dashboardStatsRepository = dashboardStatsRepository
    this.s3 = s3
    this.tmpBucketName = tmpBucketName
    this.documentBucketName = documentBucketName
  }

  public async getCases(
    params: DefaultApiGetCaseListRequest
  ): Promise<CasesListResponse> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Cases Query'
    )
    const result = await this.caseRepository.getCases(params)
    caseGetSegment?.close()
    result.data = result.data.map((caseEntity) =>
      this.getAugmentedCase(caseEntity)
    )
    return result
  }

  public async getAlerts(
    params: DefaultApiGetAlertListRequest
  ): Promise<AlertListResponse> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Alerts Query'
    )
    try {
      return await this.caseRepository.getAlerts(params)
    } finally {
      caseGetSegment?.close()
    }
  }

  public async updateCases(
    userId: string,
    caseIds: string[],
    updateRequest: CaseUpdateRequest
  ) {
    const statusChange: CaseStatusChange | undefined =
      updateRequest.caseStatus && {
        userId,
        timestamp: Date.now(),
        reason: updateRequest.reason,
        caseStatus: updateRequest.caseStatus,
        otherReason: updateRequest.otherReason,
      }
    const updates = {
      assignments: updateRequest.assignments,
      reviewAssignments: updateRequest.reviewAssignments,
      statusChange,
    }
    await this.caseRepository.updateCases(caseIds, updates)
    const tenantId = this.caseRepository.tenantId
    if (!tenantId) {
      throw new Error("Couldn't determine tenant")
    }
    if (updateRequest.caseStatus) {
      await Promise.all(
        caseIds.flatMap((caseId) => {
          return [
            this.saveCaseComment(caseId, {
              userId,
              body:
                `Case status changed to ${updateRequest.caseStatus}` +
                (updateRequest.comment ? `. ${updateRequest.comment}` : ''),
              files: updateRequest.files,
            }),
            updateRequest.caseStatus === 'CLOSED' &&
              sendWebhookTasks(tenantId, [
                {
                  event: 'CASE_CLOSED',
                  payload: {
                    caseId,
                    reasons: updateRequest.reason,
                    reasonDescriptionForOther: updateRequest.otherReason,
                    comment: updateRequest.comment,
                  },
                },
              ]),
          ]
        })
      )

      const cases = await this.caseRepository.getCasesByIds(caseIds)
      await Promise.all(
        cases.map((c) =>
          this.dashboardStatsRepository.refreshCaseStats(c.createdTimestamp)
        )
      )
    }
    return 'OK'
  }

  public async updateAlerts(
    userId: string,
    alertIds: string[],
    updateRequest: AlertUpdateRequest
  ) {
    const statusChange: CaseStatusChange | undefined =
      updateRequest.alertStatus && {
        userId,
        timestamp: Date.now(),
        reason: updateRequest.reason,
        caseStatus: updateRequest.alertStatus,
        otherReason: updateRequest.otherReason,
      }
    await this.caseRepository.updateAlerts(alertIds, {
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
      await Promise.all(
        alertIds.map((alertId) =>
          this.saveAlertComment(alertId, {
            userId,
            body: body,
            files: updateRequest.files,
          })
        )
      )
    }
    return 'OK'
  }

  public async getCase(caseId: string): Promise<Case | null> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Case Query'
    )
    const caseEntity = await this.caseRepository.getCaseById(caseId)
    caseGetSegment?.close()

    return caseEntity && this.getAugmentedCase(caseEntity)
  }

  public async getAlert(alertId: string): Promise<Alert | null> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Alert Query'
    )
    try {
      return await this.caseRepository.getAlertById(alertId)
    } finally {
      caseGetSegment?.close()
    }
  }

  public async getCaseTransactions(
    caseId: string,
    params: PaginationParams & {
      includeUsers?: boolean
    }
  ): Promise<TransactionsListResponse> {
    return await this.caseRepository.getCaseTransactions(caseId, params)
  }

  public async getAlertTransactions(
    alertId: string,
    params: PaginationParams
  ): Promise<TransactionsListResponse> {
    return await this.caseRepository.getAlertTransactions(alertId, params)
  }

  public async getCaseRules(caseId: string): Promise<Array<RulesHitPerCase>> {
    return await this.caseRepository.getCaseRules(caseId)
  }

  public async getCaseRuleTransactions(
    caseId: string,
    ruleInstanceId: string,
    params: PaginationParams,
    sortFields: { sortField: string; sortOrder: string }
  ) {
    return await this.caseRepository.getCaseRuleTransactions(
      caseId,
      ruleInstanceId,
      params,
      sortFields
    )
  }

  public async saveAlertComment(alertId: string, comment: Comment) {
    const alert = await this.caseRepository.getAlertById(alertId)
    if (alert == null) {
      throw new NotFound(`"${alertId}" alert not found`)
    }
    if (alert.caseId == null) {
      throw new Error(`Alert case id is null`)
    }
    // Copy the files from tmp bucket to document bucket
    for (const file of comment.files || []) {
      await this.s3
        .copyObject({
          CopySource: `${this.tmpBucketName}/${file.s3Key}`,
          Bucket: this.documentBucketName,
          Key: file.s3Key,
        })
        .promise()
    }
    const files = (comment.files || []).map((file) => ({
      ...file,
      bucket: this.documentBucketName,
    }))
    const savedComment = await this.caseRepository.saveAlertComment(
      alert.caseId,
      alertId,
      {
        ...comment,
        files,
      }
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
    const alert = await this.caseRepository.getAlertById(alertId)
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
    await this.caseRepository.deleteAlertComment(
      alert.caseId,
      alertId,
      commentId
    )
  }

  public async saveCaseComment(caseId: string, comment: Comment) {
    // Copy the files from tmp bucket to document bucket
    for (const file of comment.files || []) {
      await this.s3
        .copyObject({
          CopySource: `${this.tmpBucketName}/${file.s3Key}`,
          Bucket: this.documentBucketName,
          Key: file.s3Key,
        })
        .promise()
    }
    const files = (comment.files || []).map((file) => ({
      ...file,
      bucket: this.documentBucketName,
    }))
    const savedComment = await this.caseRepository.saveCaseComment(caseId, {
      ...comment,
      files,
    })
    return {
      ...savedComment,
      files: savedComment.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
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
        Bucket: this.documentBucketName,
        Delete: { Objects: comment.files.map((file) => ({ Key: file.s3Key })) },
      })
    }
    await this.caseRepository.deleteCaseComment(caseId, commentId)
  }

  private getAugmentedCase(caseEntity: Case) {
    const commentsWithUrl = caseEntity.comments?.map((comment) => ({
      ...comment,
      files: comment.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
    }))
    return { ...caseEntity, comments: commentsWithUrl }
  }

  private getDownloadLink(file: FileInfo): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.documentBucketName,
      Key: file.s3Key,
      Expires: 3600,
    })
  }

  //Temporary code for transition
  public async updateCasesByTransactionIds(
    userId: string,
    transactionIds: string[],
    transactionUpdates: TransactionUpdateRequest
  ) {
    const caseIds: string[] = (
      await this.caseRepository.getCasesByTransactionIds(transactionIds)
    ).map((caseEntity) => caseEntity.caseId as string)
    return this.updateCases(userId, caseIds, transactionUpdates)
  }

  public async saveCaseCommentByTransaction(
    transactionId: string,
    comment: Comment
  ) {
    const cases = await this.caseRepository.getCasesByTransactionId(
      transactionId
    )
    if (cases.length) {
      return this.saveCaseComment(cases[0].caseId as string, comment)
    }
  }

  public async deleteCaseCommentByTransaction(
    transactionId: string,
    commentId: string
  ) {
    const cases = await this.caseRepository.getCasesByTransactionId(
      transactionId
    )
    if (cases.length) {
      return this.deleteCaseComment(cases[0].caseId as string, commentId)
    }
  }

  public async escalateCase(
    caseId: string,
    caseUpdateRequest: CaseUpdateRequest,
    accounts: Account[]
  ): Promise<void> {
    const c = await this.getCase(caseId)
    if (!c) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }
    if (c.caseHierarchyDetails?.parentCaseId) {
      throw new NotFound(
        `Cannot escalated an already escalated case. Parent case ${c.caseHierarchyDetails?.parentCaseId}`
      )
    }

    const existingReviewAssignments = c.reviewAssignments || []
    await this.updateCases((getContext()?.user as Account).id, [caseId], {
      ...caseUpdateRequest,
      reviewAssignments:
        existingReviewAssignments.length > 0
          ? existingReviewAssignments
          : [this.getEscalationAssignment(accounts)],
      caseStatus: 'ESCALATED',
    })
  }

  public async escalateAlerts(
    caseId: string,
    caseEscalationRequest: CaseEscalationRequest,
    accounts: Account[]
  ): Promise<string> {
    const c = await this.getCase(caseId)
    if (!c) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }
    if (c.caseHierarchyDetails?.parentCaseId) {
      throw new BadRequest(
        `Cannot escalated an already escalated case. Parent case ${c.caseHierarchyDetails?.parentCaseId}`
      )
    }
    const { alertEscalations, caseUpdateRequest } = caseEscalationRequest
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
        return {
          ...escalatedAlert,
          alertStatus: 'ESCALATED',
          reviewAssignments: [this.getEscalationAssignment(accounts)],
          statusChanges: escalatedAlert.statusChanges
            ? [...escalatedAlert.statusChanges, lastStatusChange]
            : [lastStatusChange],
          lastStatusChange: lastStatusChange,
        }
      })
    const remainingAlerts = c.alerts?.filter(
      (alert) =>
        !alertEscalations!.some(
          (alertEscalation) => alertEscalation.alertId === alert.alertId
        )
    )
    if (
      (!remainingAlerts || remainingAlerts.length === 0) &&
      caseUpdateRequest
    ) {
      await this.escalateCase(caseId, caseUpdateRequest, accounts)
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

    let caseHierarchyDetailsForOriginalCase: CaseHierarchyDetails = {
      childCaseIds: [childCaseId],
    }
    if (c.caseHierarchyDetails?.childCaseIds) {
      caseHierarchyDetailsForOriginalCase = {
        childCaseIds: [...c.caseHierarchyDetails.childCaseIds, childCaseId],
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

    await this.caseRepository.addCaseMongo(newCase)
    await this.caseRepository.addCaseMongo(updatedExistingCase)
    if (caseUpdateRequest) {
      await this.updateCases((getContext()?.user as Account).id, [caseId], {
        ...caseUpdateRequest,
        comment: `Alert(s) ${escalatedAlerts!
          .map((alert) => alert.alertId)
          .join(', ')} ESCALATED by: ${(getContext()?.user as Account).name}. ${
          caseUpdateRequest.comment
        }`,
      })
    }

    return childCaseId
  }

  private getEscalationAssignment(accounts: Account[]): Assignment {
    const escalationAssineeCandidates = accounts.filter(
      (account) => account.role === 'admin'
    )
    if (escalationAssineeCandidates.length === 0) {
      throw new NotFound(`Cannot find admin users to assign the case to.`)
    }
    const assignee = _.sample(escalationAssineeCandidates)!
    return {
      assigneeUserId: assignee.id,
      timestamp: Date.now(),
    }
  }
}
