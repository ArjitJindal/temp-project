import * as createError from 'http-errors'
import { NotFound } from 'http-errors'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import * as AWS from 'aws-sdk'
import _ from 'lodash'
import { MongoClient } from 'mongodb'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { CasesListResponse } from '@/@types/openapi-internal/CasesListResponse'
import { CaseUpdateRequest } from '@/@types/openapi-internal/CaseUpdateRequest'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { TransactionUpdateRequest } from '@/@types/openapi-internal/TransactionUpdateRequest'
import { RulesHitPerCase } from '@/@types/openapi-internal/RulesHitPerCase'
import { PaginationParams } from '@/utils/pagination'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { addNewSubsegment } from '@/core/xray'
import { sendWebhookTasks } from '@/services/webhook/utils'
import { getContext } from '@/core/utils/context'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { CaseClosedDetails } from '@/@types/openapi-public/CaseClosedDetails'
import {
  CaseAlertsCommonService,
  S3Config,
} from '@/services/case-alerts-common'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { CaseConfig } from '@/lambdas/console-api-case/app'
import { isCaseAvailable } from '@/lambdas/console-api-case/services/utils'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'
import { AlertsService } from '@/services/alerts'
import { AlertClosedDetails } from '@/@types/openapi-public/AlertClosedDetails'

export class CaseService extends CaseAlertsCommonService {
  caseRepository: CaseRepository
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

  public async updateCases(
    userId: string,
    caseIds: string[],
    updateRequest: CaseUpdateRequest
  ) {
    const dashboardStatsRepository = new DashboardStatsRepository(
      this.caseRepository.tenantId,
      { mongoDb: this.caseRepository.mongoDb }
    )
    const alertsRepository = new AlertsRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })
    const alertsService = new AlertsService(
      alertsRepository,
      this.s3,
      this.s3Config
    )

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

    const cases = await this.caseRepository.getCasesByIds(caseIds)

    if (updateRequest.caseStatus) {
      await Promise.all(
        caseIds.flatMap((caseId) => {
          const case_ = cases.find((c) => c.caseId === caseId)
          if (case_) {
            const { alerts } = case_
            return [
              this.saveCaseComment(caseId, {
                userId,
                body:
                  `Case status changed to ${updateRequest.caseStatus}` +
                  (updateRequest.reason
                    ? `. Reason: ${updateRequest.reason.join(', ')}`
                    : '') +
                  (updateRequest.comment ? `\n${updateRequest.comment}` : ''),
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
                      status: updateRequest.caseStatus,
                      comment: updateRequest.comment,
                      userId:
                        case_?.caseUsers?.origin?.userId ??
                        case_?.caseUsers?.destination?.userId,
                      transactionIds: case_?.caseTransactionsIds,
                    } as CaseClosedDetails,
                  },
                ]),
              alerts
                ? Promise.all(
                    alerts?.flatMap((alert) => {
                      return [
                        alertsService.saveAlertComment(alert.alertId!, {
                          userId,
                          body:
                            `Alert status automatically changed to ${updateRequest.caseStatus} because the status of the case this alert was part of was changed to ${updateRequest.caseStatus}` +
                            (updateRequest.reason
                              ? `. Reason: ${updateRequest.reason.join(', ')}`
                              : ''),
                        }),
                        updateRequest.caseStatus === 'CLOSED' &&
                          sendWebhookTasks(tenantId, [
                            {
                              event: 'ALERT_CLOSED',
                              payload: {
                                alert: alert.alertId!,
                                reasons: updateRequest.reason,
                                reasonDescriptionForOther:
                                  updateRequest.otherReason,
                                status: updateRequest.caseStatus,
                                userId:
                                  case_?.caseUsers?.origin?.userId ??
                                  case_?.caseUsers?.destination?.userId,
                                transactionIds: case_?.caseTransactionsIds,
                              } as AlertClosedDetails,
                            },
                          ]),
                      ]
                    })
                  )
                : {},
            ]
          }
        })
      )

      await Promise.all(
        cases.map((c) =>
          dashboardStatsRepository.refreshCaseStats(c.createdTimestamp)
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

  public async escalateCase(
    caseId: string,
    caseUpdateRequest: CaseUpdateRequest,
    accounts: Account[]
  ): Promise<{ assigneeIds: string[] }> {
    const c = await this.getCase(caseId)
    if (!c) {
      throw new NotFound(`Cannot find case ${caseId}`)
    }

    const existingReviewAssignments = c.reviewAssignments || []
    const reviewAssignments =
      existingReviewAssignments.length > 0
        ? existingReviewAssignments
        : this.getEscalationAssignments(accounts)

    const account = getContext()?.user
    if (_.isEmpty(c.assignments) && account?.id) {
      caseUpdateRequest.assignments = [
        { assigneeUserId: account.id, timestamp: Date.now() },
      ]
    }
    await this.updateCases((getContext()?.user as Account).id, [caseId], {
      ...caseUpdateRequest,
      reviewAssignments,
      caseStatus: 'ESCALATED',
    })
    return {
      assigneeIds: reviewAssignments.map((v) => v.assigneeUserId),
    }
  }
}
