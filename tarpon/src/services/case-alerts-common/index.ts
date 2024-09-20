import { sample } from 'lodash'
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Credentials } from 'aws-lambda'
import { Account } from '@/@types/openapi-internal/Account'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { traceable } from '@/core/xray'
import { envIs } from '@/utils/env'
import { S3Config, S3Service } from '@/services/aws/s3-service'

@traceable
export class CaseAlertsCommonService {
  protected s3: S3
  protected s3Config: S3Config
  protected s3Service: S3Service
  protected awsCredentials?: Credentials

  constructor(s3: S3, s3Config: S3Config, awsCredentials?: Credentials) {
    this.s3 = s3
    this.s3Config = s3Config
    this.s3Service = new S3Service(s3, s3Config)
    this.awsCredentials = awsCredentials
  }

  protected getEscalationAssignments(accounts: Account[]): Assignment[] {
    const escalationAssineeCandidates = accounts.filter(
      (account) => account.isEscalationContact
    )
    if (!escalationAssineeCandidates?.length) {
      return []
    }
    const assignee = sample(escalationAssineeCandidates) ?? accounts[0]
    return [
      {
        assigneeUserId: assignee.id,
        timestamp: Date.now(),
      },
    ]
  }

  protected async getDownloadLink(file: FileInfo) {
    if (envIs('test')) {
      return ''
    }

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
