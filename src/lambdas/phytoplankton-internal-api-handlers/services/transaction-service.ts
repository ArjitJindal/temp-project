import * as createError from 'http-errors'
import { Comment } from '../../../@types/openapi-internal/Comment'
import { FileInfo } from '../../../@types/openapi-internal/FileInfo'
import { DefaultApiGetTransactionsListRequest } from '../../../@types/openapi-internal/RequestParameters'
import { TransactionsListResponse } from '../../../@types/openapi-internal/TransactionsListResponse'
import { connectToDB } from '../../../utils/docDBUtils'
import { TransactionRepository } from '../../rules-engine/repositories/transaction-repository'

export class TransactionService {
  tenantId: string
  transactionRepository?: TransactionRepository
  s3: AWS.S3
  documentBucketName: string
  tmpBucketName: string

  constructor(
    tenantId: string,
    s3: AWS.S3,
    tmpBucketName: string,
    documentBucketName: string
  ) {
    this.tenantId = tenantId
    this.s3 = s3
    this.tmpBucketName = tmpBucketName
    this.documentBucketName = documentBucketName
  }
  async initialize() {
    const client = await connectToDB()
    this.transactionRepository = new TransactionRepository(this.tenantId, {
      mongoDb: client,
    })
  }

  async getTransactions(
    params: DefaultApiGetTransactionsListRequest
  ): Promise<TransactionsListResponse> {
    if (!this.transactionRepository) {
      await this.initialize()
    }
    const result = await this.transactionRepository!.getTransactions(params)
    result.data = result.data.map((transaction) => {
      const commentsWithUrl = transaction.comments?.map((comment) => ({
        ...comment,
        files: comment.files?.map((file) => ({
          ...file,
          downloadLink: this.getDownloadLink(file),
        })),
      }))
      return { ...transaction, comments: commentsWithUrl }
    })
    return result
  }

  async saveTransactionComment(transactionId: string, comment: Comment) {
    if (!this.transactionRepository) {
      await this.initialize()
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
    const savedComment =
      await this.transactionRepository!.saveTransactionComment(transactionId, {
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

  async deleteTransactionComment(transactionId: string, commentId: string) {
    if (!this.transactionRepository) {
      await this.initialize()
    }

    const tranasction =
      await this.transactionRepository!.getTransactionCaseManagementById(
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
    await this.transactionRepository!.deleteTransactionComment(
      transactionId,
      commentId
    )
  }

  private getDownloadLink(file: FileInfo): string {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.documentBucketName,
      Key: file.s3Key,
      Expires: 3600,
    })
  }
}
