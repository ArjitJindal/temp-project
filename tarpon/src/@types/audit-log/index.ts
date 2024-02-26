import { Assignment } from '../openapi-internal/Assignment'
import { AuditLog } from '../openapi-internal/AuditLog'
import { CaseStatus } from '../openapi-internal/CaseStatus'
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
}
