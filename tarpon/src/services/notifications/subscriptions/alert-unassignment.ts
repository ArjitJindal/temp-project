import { getUnassignmentNotification } from './utils/assignments'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import {
  AlertLogMetaDataType,
  AuditLogAssignmentsImage,
} from '@/@types/audit-log'

type Payload = NotificationRawPayload<
  AuditLogAssignmentsImage,
  AlertLogMetaDataType
>

export class AlertUnassignment extends Subscriptions {
  type: NotificationType = 'ALERT_UNASSIGNMENT'

  async toSend(payload: Payload): Promise<boolean> {
    return payload.type === 'ALERT' && payload.subtype === 'ASSIGNMENT'
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    return getUnassignmentNotification(payload, 'ALERT')
  }
}
