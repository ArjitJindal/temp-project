import _ from 'lodash'
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
  protected s3: AWS.S3
  protected s3Config: S3Config

  constructor(s3: AWS.S3, s3Config: S3Config) {
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
    const assignee = _.sample(escalationAssineeCandidates)!
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
      await this.s3
        .copyObject({
          CopySource: `${this.s3Config.tmpBucketName}/${file.s3Key}`,
          Bucket: this.s3Config.documentBucketName,
          Key: file.s3Key,
        })
        .promise()
    }

    const filesTransformerd = (files || []).map((file) => ({
      ...file,
      bucket: this.s3Config.documentBucketName,
    }))

    return filesTransformerd
  }

  protected getDownloadLink(file: FileInfo) {
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.s3Config.documentBucketName,
      Key: file.s3Key,
      Expires: 3600,
    })
  }
}
