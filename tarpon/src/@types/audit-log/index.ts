import { AlertStatusUpdateRequest } from '../openapi-internal/AlertStatusUpdateRequest'
import { Assignment } from '../openapi-internal/Assignment'
import { AuditLog } from '../openapi-internal/AuditLog'
import { CaseStatus } from '../openapi-internal/CaseStatus'
import { CaseStatusUpdate } from '../openapi-internal/CaseStatusUpdate'
import { Comment } from '../openapi-internal/Comment'
import { Priority } from '../openapi-internal/Priority'

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
}

export type AuditLogAssignmentsImage = {
  assignments?: Assignment[]
  reviewAssignments?: Assignment[]
}

export interface CaseUpdateAuditLogImage extends Partial<CaseStatusUpdate> {
  reviewAssignments?: Assignment[]
  updatedTransactions?: string[]
  investigationTime?: number
}

export interface AlertUpdateAuditLogImage
  extends Partial<AlertStatusUpdateRequest> {
  reviewAssignments?: Assignment[]
  updatedTransactions?: string[]
}
