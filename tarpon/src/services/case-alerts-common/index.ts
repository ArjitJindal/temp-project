import { sample, uniqBy } from 'lodash'
import { GetObjectCommand, S3 } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Credentials } from 'aws-lambda'
import { Account } from '@/@types/openapi-internal/Account'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { FileInfo } from '@/@types/openapi-internal/FileInfo'
import { traceable } from '@/core/xray'
import { envIs } from '@/utils/env'
import { S3Config, S3Service } from '@/services/aws/s3-service'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { isStatusInReview, statusEscalated } from '@/utils/helpers'
import { getContext } from '@/core/utils/context'

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

  protected getEscalationAssignments(
    caseStatus: CaseStatus,
    existingReviewAssignments: Assignment[],
    accounts: Account[]
  ): Assignment[] {
    const isL2Escalation =
      statusEscalated(caseStatus) && !isStatusInReview(caseStatus)

    const currentUserId = getContext()?.user?.id

    const isL1Escalation = !isL2Escalation

    let allL1EscalationAccounts = accounts.filter(
      (account) => account.escalationLevel === 'L1'
    )

    if (!allL1EscalationAccounts.length) {
      allL1EscalationAccounts = accounts.filter(
        (account) => account.role === 'admin'
      )
    }

    if (isL1Escalation) {
      const anyExistingL1Assignment = existingReviewAssignments.some(
        (assignment) =>
          assignment.escalationLevel === 'L1' ||
          (!assignment.escalationLevel &&
            allL1EscalationAccounts.some(
              (account) => account.id === assignment.assigneeUserId
            ))
      )

      if (anyExistingL1Assignment) {
        return uniqBy(existingReviewAssignments, 'assigneeUserId')
      }

      const randomL1EscalationReviewer = sample(allL1EscalationAccounts)

      if (!randomL1EscalationReviewer) {
        throw new Error('No L1 escalation reviewer found')
      }

      return uniqBy(
        [
          ...existingReviewAssignments.filter(
            (assignment) => assignment.escalationLevel
          ),
          {
            assigneeUserId: randomL1EscalationReviewer.id,
            timestamp: Date.now(),
            escalationLevel: 'L1',
            assignedByUserId: currentUserId,
          },
        ],
        'assigneeUserId'
      )
    }

    if (isL2Escalation) {
      const existingL1Contact = existingReviewAssignments.find(
        (assignment) => assignment.escalationLevel === 'L1'
      )

      const findEscalationReviewer = accounts.find(
        (account) => account.id === existingL1Contact?.assigneeUserId
      )?.escalationReviewerId

      if (!findEscalationReviewer) {
        throw new Error('No L2 escalation reviewer found')
      }

      return uniqBy(
        [
          ...existingReviewAssignments.filter(
            (assignment) => assignment.escalationLevel
          ),
          {
            assigneeUserId: findEscalationReviewer,
            timestamp: Date.now(),
            escalationLevel: 'L2',
            assignedByUserId: currentUserId,
          },
        ],
        'assigneeUserId'
      )
    }

    return uniqBy(existingReviewAssignments, 'assigneeUserId')
  }
}
