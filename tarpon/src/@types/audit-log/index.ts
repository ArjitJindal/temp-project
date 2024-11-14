import { AlertStatusUpdateRequest } from '../openapi-internal/AlertStatusUpdateRequest'
import { Assignment } from '../openapi-internal/Assignment'
import { AuditLog } from '../openapi-internal/AuditLog'
import { CaseStatus } from '../openapi-internal/CaseStatus'
import { CaseStatusUpdate } from '../openapi-internal/CaseStatusUpdate'
import { Comment } from '../openapi-internal/Comment'
import { FileInfo } from '../openapi-internal/FileInfo'
import { InternalBusinessUser } from '../openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '../openapi-internal/InternalConsumerUser'
import { Priority } from '../openapi-internal/Priority'
import { ReportParameters } from '../openapi-internal/ReportParameters'
import { ReportRevision } from '../openapi-internal/ReportRevision'
import { ReportStatus } from '../openapi-internal/ReportStatus'
import { UserType } from '../user/user-type'

export type AuditLogRecord = {
  tenantId: string
  payload: AuditLog
}

export interface CommentAuditLogImage extends Comment {}

export type CaseLogMetaDataType = {
  caseAssignment?: Assignment[]
  caseCreationTimestamp?: number
  casePriority?: Priority
  caseStatus?: CaseStatus
  reviewAssignments?: Assignment[]
}

export type AlertLogMetaDataType = {
  alertAssignment?: Assignment[]
  alertCreationTimestamp?: number
  alertPriority?: Priority
  alertStatus?: CaseStatus
  reviewAssignments?: Assignment[]
  caseId?: string
}

export type SarLogMetaDataType = {
  name?: string
  description?: string
  caseId?: string
  reportTypeId?: string
  caseUserId?: string
  createdById?: string
  parameters?: ReportParameters
  comments?: Array<Comment>
  revisions?: Array<ReportRevision>
  attachments?: Array<FileInfo>
  caseUser?: InternalConsumerUser | InternalBusinessUser
  sarCreationTimestamp?: number
}

export type UserLogMetaDataType = {
  userType: UserType
}

export type AuditLogAssignmentsImage = {
  assignments?: Assignment[]
  reviewAssignments?: Assignment[]
}

export interface CaseUpdateAuditLogImage extends Partial<CaseStatusUpdate> {
  reviewAssignments?: Assignment[]
  updatedTransactions?: string[]
  investigationTime?: number
  assignments?: Assignment[]
}

export interface AlertUpdateAuditLogImage
  extends Partial<AlertStatusUpdateRequest> {
  reviewAssignments?: Assignment[]
  updatedTransactions?: string[]
  assignments?: Assignment[]
}

export interface SarUpdateAuditLogImage {
  status: ReportStatus
  statusInfo?: string
}
