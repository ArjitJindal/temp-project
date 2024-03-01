import { AlertStatusUpdateRequest } from '../openapi-internal/AlertStatusUpdateRequest'
import { Assignment } from '../openapi-internal/Assignment'
import { AuditLog } from '../openapi-internal/AuditLog'
import { CaseStatus } from '../openapi-internal/CaseStatus'
import { CaseStatusUpdate } from '../openapi-internal/CaseStatusUpdate'
import { Priority } from '../openapi-internal/Priority'

export type AuditLogRecord = {
  tenantId: string
  payload: AuditLog
}

export type CaseLogMetaDataType = {
  caseAssignment?: Assignment[]
  caseCreationTimestamp?: number
  casePriority?: Priority
  caseStatus?: CaseStatus
}

export type AlertLogMetaDataType = {
  alertAssignment?: Assignment[]
  alertCreationTimestamp?: number
  alertPriority?: Priority
  alertStatus?: CaseStatus
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
