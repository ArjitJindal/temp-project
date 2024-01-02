import {
  DeleteObjectsCommand,
  ListObjectsCommand,
  S3Client,
} from '@aws-sdk/client-s3'
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
    let marker: string | undefined

    do {
      const response = await s3Client.send(
        new ListObjectsCommand({
          Bucket: process.env.DOCUMENT_BUCKET,
          Prefix: `${tenantId}/`,
          MaxKeys: 1000,
          Marker: marker,
        })
      )

      const objects = response.Contents?.map((content) => ({
        Key: content.Key,
      }))

      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: process.env.DOCUMENT_BUCKET,
          Delete: {
            Objects: objects,
          },
        })
      )

      marker = response.NextMarker

      logger.info(`Deleted ${objects?.length} files.`)
    } while (marker)

    logger.info(`Deleted S3 files.`)
  }
}
