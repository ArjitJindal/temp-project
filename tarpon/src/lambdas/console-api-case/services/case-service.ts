import * as createError from 'http-errors'
import { NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as AWS from 'aws-sdk'
import _ from 'lodash'
import { MongoClient } from 'mongodb'
import { CasesAlertsAuditLogService } from './case-alerts-audit-log-service'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { CasesListResponse } from '@/@types/openapi-internal/CasesListResponse'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { RulesHitPerCase } from '@/@types/openapi-internal/RulesHitPerCase'
import { PaginationParams } from '@/utils/pagination'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { addNewSubsegment } from '@/core/xray'
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
import { getMongoDbClient, withTransaction } from '@/utils/mongoDBUtils'
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

export class CaseService extends CaseAlertsCommonService {
  caseRepository: CaseRepository
  alertsService: AlertsService
  auditLogService: CasesAlertsAuditLogService
  tenantId: string
  mongoDb: MongoClient

  public static async fromEvent(
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
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

  constructor(caseRepository: CaseRepository, s3: AWS.S3, s3Config: S3Config) {
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

  private getStatusChange(
    updates: CaseStatusUpdate,
    options?: { cascadeAlertsUpdate?: boolean }
  ): CaseStatusChange {
    const { cascadeAlertsUpdate = true } = options ?? {}
    const userId = (getContext()?.user as Account).id

    return {
      userId: cascadeAlertsUpdate ? userId! : FLAGRIGHT_SYSTEM_USER,
      timestamp: Date.now(),
      reason: updates.reason,
      caseStatus: updates.caseStatus,
      otherReason: updates.otherReason,
    }
  }

  private getCaseCommentBody(updateRequest: CaseStatusUpdate): string {
    const { caseStatus, reason, otherReason, comment } = updateRequest
    let body = `Case status changed to ${caseStatus}`

    const allReasons = [
      ...(reason?.filter((x) => x !== 'Other') ?? []),
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
    const webhookTasks = cases.map((case_) => ({
      event: 'CASE_CLOSED',
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
      } as CaseClosedDetails,
    })) as ThinWebhookDeliveryTask[]

    await sendWebhookTasks(this.tenantId, webhookTasks)
  }

  public async updateCasesStatus(
    caseIds: string[],
    updates: CaseStatusUpdate,
    options?: {
      cascadeAlertsUpdate?: boolean
      reviewAssignments?: Assignment[]
    }
  ): Promise<void> {
    const { cascadeAlertsUpdate = true } = options ?? {}
    const dashboardStatsRepository = new DashboardStatsRepository(
      this.caseRepository.tenantId,
      { mongoDb: this.caseRepository.mongoDb }
    )
    const commentBody = this.getCaseCommentBody(updates)

    const statusChange = await this.getStatusChange(updates, {
      cascadeAlertsUpdate,
    })

    const cases = await this.caseRepository.getCasesByIds(caseIds)

    await withTransaction(async () => {
      await Promise.all([
        this.caseRepository.updateStatusOfCases(caseIds, statusChange),
        this.saveCasesComment(caseIds, {
          body: commentBody,
          files: updates.files,
          userId: statusChange.userId,
        }),
      ])
      if (updates.caseStatus && cascadeAlertsUpdate) {
        const alertIds = cases
          .flatMap((c) => c.alerts ?? [])
          .filter(
            (alert) =>
              ![...new Set(['CLOSED', updates.caseStatus])].includes(
                alert.alertStatus
              )
          )
          .map((alert) => alert.alertId!)

        if (updates.caseStatus === 'ESCALATED' && options?.reviewAssignments) {
          await this.alertsService.updateReviewAssigneeToAlerts(
            alertIds,
            options.reviewAssignments
          )
        }

        await this.alertsService.updateAlertsStatus(
          alertIds,
          {
            alertStatus: updates.caseStatus,
            comment: updates.comment,
            otherReason: `Case of this alert was ${updates.caseStatus.toLowerCase()}`,
            reason: ['Other'],
            files: updates.files,
          },
          { cascadeCaseUpdates: false }
        )
      }
    })

    await Promise.all(
      cases.map((c) =>
        dashboardStatsRepository.refreshCaseStats(c.createdTimestamp)
      )
    )

    if (updates.caseStatus === 'CLOSED') {
      await this.sendCasesClosedWebhook(cases, updates)
    }

    if (updates.caseStatus === 'CLOSED' && hasFeature('SANCTIONS')) {
      const cases = await this.caseRepository.getCaseByIds(caseIds)
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
  ): Promise<Case | null> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Case Query'
    )
    const caseEntity = await this.caseRepository.getCaseById(caseId)
    caseGetSegment?.close()

    if (options?.logAuditLogView) {
      await this.auditLogService.handleViewCase(caseId)
    }

    return (
      (caseEntity &&
        isCaseAvailable(caseEntity) &&
        this.getAugmentedCase(caseEntity)) ||
      null
    )
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

  public async saveCaseComment(caseId: string, comment: Comment) {
    // Copy the files from tmp bucket to document bucket
    const files = await this.copyFiles(comment.files ?? [])

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

  private async saveCasesComment(caseIds: string[], comment: Comment) {
    const files = await this.copyFiles(comment.files ?? [])

    const savedComment = await this.caseRepository.saveCasesComment(caseIds, {
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

  public async updateCaseForEscalation(
    caseId: string,
    caseUpdateRequest: CaseEscalationsUpdateRequest
  ): Promise<void> {
    const statusChange: CaseStatusUpdate = {
      reason: caseUpdateRequest.reason,
      caseStatus: caseUpdateRequest.caseStatus,
      otherReason: caseUpdateRequest.otherReason,
      comment: caseUpdateRequest.comment,
      files: caseUpdateRequest.files,
    }

    await Promise.all([
      this.updateCasesStatus([caseId], statusChange, {
        cascadeAlertsUpdate: true,
        reviewAssignments: caseUpdateRequest.reviewAssignments,
      }),
      this.updateCasesReviewAssignments(
        [caseId],
        caseUpdateRequest.reviewAssignments ?? []
      ),
    ])
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

    if (_.isEmpty(case_.assignments) && account?.id) {
      caseUpdateRequest.assignments = [
        { assigneeUserId: account.id, timestamp: Date.now() },
      ]

      await this.caseRepository.updateCasesAssignments(
        [caseId],
        caseUpdateRequest.assignments ?? []
      )
    }

    caseUpdateRequest.caseStatus = 'ESCALATED'

    const statusChange: CaseStatusUpdate = {
      reason: caseUpdateRequest.reason,
      caseStatus: caseUpdateRequest.caseStatus,
      otherReason: caseUpdateRequest.otherReason,
      comment: caseUpdateRequest.comment,
      files: caseUpdateRequest.files,
    }

    await Promise.all([
      this.updateCasesStatus([caseId], statusChange, {
        cascadeAlertsUpdate: true,
        reviewAssignments,
      }),
      !_.isEqual(case_.reviewAssignments, reviewAssignments) &&
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
