import { getAssignmentNotification } from './utils/assignments'
import { Subscriptions } from '.'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import {
  AuditLogAssignmentsImage,
  CaseLogMetaDataType,
} from '@/@types/audit-log'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'

type Payload = NotificationRawPayload<
  AuditLogAssignmentsImage,
  CaseLogMetaDataType
>

export class CaseAssignees extends Subscriptions {
  type: NotificationType = 'CASE_ASSIGNMENT'

  async toSend(payload: Payload): Promise<boolean> {
    return payload.type === 'CASE' && payload.subtype === 'ASSIGNMENT'
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    return getAssignmentNotification(payload, 'CASE')
  }
}
