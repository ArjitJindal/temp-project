import { AuditLog } from '../openapi-internal/AuditLog'

export type AuditLogRecord = {
  tenantId: string
  payload: AuditLog
}
