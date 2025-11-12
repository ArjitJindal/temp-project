import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { AuditLogRecord } from '@/@types/audit-log'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'

type Payload = NotificationRawPayload<AuditLogRecord>

export class ApiKeyExpiring extends Subscriptions {
  type: NotificationType = 'API_KEY_EXPIRING'

  async toSend(payload: Payload): Promise<boolean> {
    return (
      payload.type === 'API-KEY' &&
      payload.action === 'APPROACHING_DEACTIVATION'
    )
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    return {
      notificationType: 'API_KEY_EXPIRING',
      createdAt: Date.now(),
      entityId: payload.entityId,
      triggeredBy: FLAGRIGHT_SYSTEM_USER,
      entityType: 'API_KEY',
      recievers: [], // Will be populated by the notifications service
      notificationData: {
        type: 'API_KEY_EXPIRING',
      },
      metadata: {},
    }
  }
}
