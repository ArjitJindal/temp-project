import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { publishAuditLog } from '@/services/audit-log'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { traceable } from '@/core/xray'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { Comment } from '@/@types/openapi-internal/Comment'

@traceable
export class UserAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async handleAuditLogForUserViewed(userId: string): Promise<void> {
    await this.createAuditLog(userId, 'VIEW')
  }
  public async handleAuditLogForUserUpdate(
    updateRequest: UserUpdateRequest,
    userId: string
  ): Promise<void> {
    const auditLog: AuditLog = {
      type: 'USER',
      action: 'UPDATE',
      timestamp: Date.now(),
      newImage: updateRequest,
      entityId: userId,
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  public async handleAuditLogForAddComment(
    userId: string,
    comment: Comment
  ): Promise<void> {
    const auditLog: AuditLog = {
      type: 'USER',
      subtype: 'COMMENT',
      action: 'CREATE',
      timestamp: Date.now(),
      newImage: comment,
      entityId: userId,
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  public async handleAuditLogForDeleteComment(
    userId: string,
    comment: Comment
  ): Promise<void> {
    const auditLog: AuditLog = {
      type: 'USER',
      subtype: 'COMMENT',
      action: 'DELETE',
      timestamp: Date.now(),
      oldImage: comment,
      newImage: {},
      entityId: userId,
    }
    await publishAuditLog(this.tenantId, auditLog)
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
