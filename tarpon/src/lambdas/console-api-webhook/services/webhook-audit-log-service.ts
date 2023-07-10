import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { publishAuditLog } from '@/services/audit-log'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'

import { traceable } from '@/core/xray'

@traceable
export class WebhookAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async handleAuditLogForWebhookCreated(
    webhookId: string
  ): Promise<void> {
    await this.createAuditLog(webhookId, 'CREATE')
  }

  public async handleAuditLogForWebhookUpdated(
    webhookId: string,
    existingWebhook?: any,
    updatedWebhook?: any
  ): Promise<void> {
    await this.createAuditLog(
      webhookId,
      'UPDATE',
      existingWebhook,
      updatedWebhook
    )
  }

  public async handleAuditLogForWebhookDeleted(
    webhookId: string
  ): Promise<void> {
    await this.createAuditLog(webhookId, 'DELETE')
  }

  private async createAuditLog(
    webhookId: string,
    logAction: AuditLogActionEnum,
    existingWebhook?: any,
    updatedWebhook?: any
  ) {
    const auditLog: AuditLog = {
      type: 'WEBHOOK',
      action: logAction,
      timestamp: Date.now(),
      entityId: webhookId,
      oldImage: existingWebhook,
      newImage: updatedWebhook,
    }
    await publishAuditLog(this.tenantId, auditLog)
  }
}
