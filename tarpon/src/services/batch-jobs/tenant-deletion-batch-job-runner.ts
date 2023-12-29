import {
  DeleteObjectsCommand,
  ListObjectsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { chunk } from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { TenantDeletionBatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
})

export class TenantDeletionBatchJobRunner extends BatchJobRunner {
  protected async run(job: TenantDeletionBatchJob): Promise<void> {
    await this.deleteS3Files(job.tenantId)
  }

  private async deleteS3Files(tenantId: string) {
    const response = await s3Client.send(
      new ListObjectsCommand({
        Bucket: process.env.DOCUMENT_BUCKET,
        Prefix: `${tenantId}/`,
      })
    )

    const keys = response.Contents?.map((content) => content.Key) ?? []

    logger.info(`Deleting ${keys.length} files from S3`)

    const chunks = chunk(keys, 1000)
    let i = 0
    for (const chunk of chunks) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: process.env.DOCUMENT_BUCKET,
          Delete: {
            Objects: chunk.map((key) => ({ Key: key })),
          },
        })
      )
      i += chunk.length
      logger.info(`Deleted ${i} / ${keys.length} files from S3`)
    }
  }
}
