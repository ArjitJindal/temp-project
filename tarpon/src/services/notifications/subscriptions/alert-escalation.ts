import { getEntityMetadata } from './utils/commonUtils'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import {
  AlertUpdateAuditLogImage,
  AlertLogMetaDataType,
} from '@/@types/audit-log'
import { EscalationNotification } from '@/@types/openapi-internal/EscalationNotification'

type Payload = NotificationRawPayload<
  AlertUpdateAuditLogImage,
  AlertLogMetaDataType
>

export class AlertEscalations extends Subscriptions {
  type: NotificationType = 'ALERT_ESCALATION'

  async toSend(payload: Payload): Promise<boolean> {
    return payload.type === 'ALERT' && payload.action === 'ESCALATE'
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification<EscalationNotification> | undefined> {
    const reviewAssignments = payload.newImage?.reviewAssignments
    const alertStatus = payload.newImage?.alertStatus

    if (!reviewAssignments?.length || alertStatus !== 'ESCALATED') {
      return
    }

    const recievers = reviewAssignments.map(
      (assignment) => assignment.assigneeUserId
    )

    const notification: PartialNotification<EscalationNotification> = {
      createdAt: Date.now(),
      entityId: payload.entityId,
      entityType: 'ALERT',
      notificationType: 'ALERT_ESCALATION',
      recievers,
      triggeredBy: payload.user?.id || 'FLAGRIGHT_SYSTEM_USER',
      notificationData: {
        type: 'ESCALATION',
        reviewAssignments,
        status: alertStatus,
        reason: payload.newImage?.reason ?? [],
        childCaseId: payload.newImage?.alertCaseId,
      },
      metadata: getEntityMetadata('ALERT', payload.logMetadata),
    }

    return notification
  }
}
