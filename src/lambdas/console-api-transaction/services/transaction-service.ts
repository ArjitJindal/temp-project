import * as createError from 'http-errors'
import { Comment } from '@/@types/openapi-internal/Comment'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { DefaultApiGetTransactionsListRequest } from '@/@types/openapi-internal/RequestParameters'
import { TransactionsListResponse } from '@/@types/openapi-internal/TransactionsListResponse'
import { TransactionUpdateRequest } from '@/@types/openapi-internal/TransactionUpdateRequest'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { TransactionStatusChange } from '@/@types/openapi-internal/TransactionStatusChange'
import { TransactionCaseManagement } from '@/@types/openapi-internal/TransactionCaseManagement'
import { Currency } from '@/utils/currency-utils'
import { TransactionsStatsByTypesResponse } from '@/@types/openapi-internal/TransactionsStatsByTypesResponse'
import { TransactionsStatsByTimeResponse } from '@/@types/openapi-internal/TransactionsStatsByTimeResponse'
import { TransactionsUniquesField } from '@/@types/openapi-internal/TransactionsUniquesField'

export class TransactionService {
  transactionRepository: TransactionRepository
  s3: AWS.S3
  documentBucketName: string
  tmpBucketName: string

  constructor(
    transactionRepository: TransactionRepository,
    s3: AWS.S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.transactionRepository = transactionRepository
    this.s3 = s3
    this.tmpBucketName = tmpBucketName
    this.documentBucketName = documentBucketName
  }

  public async getTransactions(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<TransactionsListResponse> {
    const result = await this.transactionRepository.getTransactions(params)
    result.data = result.data.map((transaction) =>
      this.getAugmentedTransactionCaseManagement(transaction)
    )
    return result
  }

  public async getStatsByType(
    params: DefaultApiGetTransactionsListRequest,
    referenceCurrency: Currency
  ): Promise<TransactionsStatsByTypesResponse['data']> {
    return await this.transactionRepository.getStatsByType(
      params,
      referenceCurrency
    )
  }

  public async getStatsByTime(
    params: DefaultApiGetTransactionsListRequest,
    referenceCurrency: Currency
  ): Promise<TransactionsStatsByTimeResponse['data']> {
    return await this.transactionRepository.getStatsByTime(
      params,
      referenceCurrency
    )
  }

  public async updateTransactions(
    userId: string,
    transactionIds: string[],
    updateRequest: TransactionUpdateRequest
  ) {
    const statusChange: TransactionStatusChange | undefined =
      (updateRequest.status || updateRequest.caseStatus) && {
        userId,
        status: updateRequest.status,
        timestamp: Date.now(),
        reason: updateRequest.reason,
        caseStatus: updateRequest.caseStatus,
        otherReason: updateRequest.otherReason,
      }
    const updates = {
      assignments: updateRequest.assignments,
      status: updateRequest.status,
      statusChange: statusChange,
      caseStatus: updateRequest.caseStatus,
    }
    await this.transactionRepository.updateTransactionsCaseManagement(
      transactionIds,
      updates
    )
    return 'OK'
  }

  public async getTransaction(
    transactionId: string
  ): Promise<TransactionCaseManagement | null> {
    const transaction =
      await this.transactionRepository.getTransactionCaseManagement(
        transactionId
      )
    return (
      transaction && this.getAugmentedTransactionCaseManagement(transaction)
    )
  }

  public async saveTransactionComment(transactionId: string, comment: Comment) {
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
    const savedComment =
      await this.transactionRepository.saveTransactionComment(transactionId, {
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

  public async deleteTransactionComment(
    transactionId: string,
    commentId: string
  ) {
    const tranasction =
      await this.transactionRepository.getTransactionCaseManagementById(
        transactionId
      )
    if (!tranasction) {
      throw new createError.NotFound(`Transaction ${transactionId} not found`)
    }

    const comment = tranasction?.comments?.find(
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
    await this.transactionRepository.deleteTransactionComment(
      transactionId,
      commentId
    )
  }

  private getAugmentedTransactionCaseManagement(
    transaction: TransactionCaseManagement
  ) {
    const commentsWithUrl = transaction.comments?.map((comment) => ({
      ...comment,
      files: comment.files?.map((file) => ({
        ...file,
        downloadLink: this.getDownloadLink(file),
      })),
    }))
    return { ...transaction, comments: commentsWithUrl }
  }

  private getDownloadLink(file: FileInfo): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.documentBucketName,
      Key: file.s3Key,
      Expires: 3600,
    })
  }

  public async getUniques(params: {
    field: TransactionsUniquesField
    filter?: string
  }): Promise<string[]> {
    return this.transactionRepository.getUniques(params)
  }
}
