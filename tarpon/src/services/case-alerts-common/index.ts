import { sample } from 'lodash'
import { S3, CopyObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Account } from '@/@types/openapi-internal/Account'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { traceable } from '@/core/xray'

export type S3Config = {
  tmpBucketName: string
  documentBucketName: string
}

@traceable
export class CaseAlertsCommonService {
  protected s3: S3
  protected s3Config: S3Config

  constructor(s3: S3, s3Config: S3Config) {
    this.s3 = s3
    this.s3Config = s3Config
  }

  protected getEscalationAssignments(accounts: Account[]): Assignment[] {
    const escalationAssineeCandidates = accounts.filter(
      (account) => account.isEscalationContact
    )
    if (!escalationAssineeCandidates?.length) {
      return []
    }
    const assignee = sample(escalationAssineeCandidates)!
    return [
      {
        assigneeUserId: assignee.id,
        timestamp: Date.now(),
      },
    ]
  }

  protected async copyFiles(files: FileInfo[]): Promise<FileInfo[]> {
    // Copy the files from tmp bucket to document bucket
    for (const file of files || []) {
      const copyObjectCommand = new CopyObjectCommand({
        CopySource: `${this.s3Config.tmpBucketName}/${file.s3Key}`,
        Bucket: this.s3Config.documentBucketName,
        Key: file.s3Key,
      })

      await this.s3.send(copyObjectCommand)
    }

    const filesTransformerd = (files || []).map((file) => ({
      ...file,
      bucket: this.s3Config.documentBucketName,
    }))

    return filesTransformerd
  }

  protected async getDownloadLink(file: FileInfo) {
    const getObjectCommand = new GetObjectCommand({
      Bucket: this.s3Config.documentBucketName,
      Key: file.s3Key,
    })

    return await getSignedUrl(this.s3, getObjectCommand, {
      expiresIn: 3600,
    })
  }

  protected async getUpdatedFiles(files: FileInfo[] | undefined) {
    return Promise.all(
      (files ?? []).map(async (file) => ({
        ...file,
        downloadLink: await this.getDownloadLink(file),
      }))
    )
  }
}
