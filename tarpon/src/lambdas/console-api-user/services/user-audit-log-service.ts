import _ from 'lodash'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { publishAuditLog } from '@/services/audit-log'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'

export class UserAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async handleAuditLogForuserViewed(userId: string): Promise<void> {
    await this.createAuditLog(userId, 'VIEW')
  }

  private async createAuditLog(userId: string, logAction: AuditLogActionEnum) {
    const auditLog: AuditLog = {
      type: 'USER',
      action: logAction,
      timestamp: Date.now(),
      entityId: userId,
    }
    await publishAuditLog(this.tenantId, auditLog)
  }
}
