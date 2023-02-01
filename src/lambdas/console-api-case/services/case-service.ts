import * as createError from 'http-errors'
import { Comment } from '@/@types/openapi-internal/Comment'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { DefaultApiGetCaseListRequest } from '@/@types/openapi-internal/RequestParameters'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { Case } from '@/@types/openapi-internal/Case'
import { CasesListResponse } from '@/@types/openapi-internal/CasesListResponse'
import { CaseUpdateRequest } from '@/@types/openapi-internal/CaseUpdateRequest'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { TransactionUpdateRequest } from '@/@types/openapi-internal/TransactionUpdateRequest'
import { CaseTransactionsListResponse } from '@/@types/openapi-internal/CaseTransactionsListResponse'
import { RulesHitPerCase } from '@/@types/openapi-internal/RulesHitPerCase'
import { PaginationParams } from '@/utils/pagination'
import { DashboardStatsRepository } from '@/lambdas/console-api-dashboard/repositories/dashboard-stats-repository'
import { addNewSubsegment } from '@/core/xray'

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
      statusChange: statusChange,
      caseStatus: updateRequest.caseStatus,
    }
    await this.caseRepository.updateCases(caseIds, updates)
    if (updateRequest.caseStatus) {
      await Promise.all(
        caseIds.map((caseId) =>
          this.saveCaseComment(caseId, {
            userId,
            body:
              `Case Status Changed to ${updateRequest.caseStatus}` +
              (updateRequest.comment ? `. ${updateRequest.comment}` : ''),
            files: updateRequest.files,
          })
        )
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

  public async getCase(
    caseId: string,
    params: {
      includeTransactions?: boolean
      includeTransactionEvents?: boolean
      includeTransactionUsers?: boolean
    } = {}
  ): Promise<Case | null> {
    const caseGetSegment = await addNewSubsegment(
      'Case Service',
      'Mongo Get Case Query'
    )
    const caseEntity = await this.caseRepository.getCaseById(caseId, params)
    caseGetSegment?.close()

    return caseEntity && this.getAugmentedCase(caseEntity)
  }

  public async getCaseTransactions(
    caseId: string,
    params: PaginationParams & {
      includeUsers?: boolean
    }
  ): Promise<CaseTransactionsListResponse> {
    return await this.caseRepository.getCaseTransactions(caseId, params)
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
      await this.caseRepository.getCasesByTransactionIds(
        transactionIds,
        'TRANSACTION'
      )
    ).map((caseEntity) => caseEntity.caseId as string)
    return this.updateCases(userId, caseIds, transactionUpdates)
  }

  public async saveCaseCommentByTransaction(
    transactionId: string,
    comment: Comment
  ) {
    const cases = await this.caseRepository.getCasesByTransactionId(
      transactionId,
      'TRANSACTION'
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
      transactionId,
      'TRANSACTION'
    )
    if (cases.length) {
      return this.deleteCaseComment(cases[0].caseId as string, commentId)
    }
  }
}
