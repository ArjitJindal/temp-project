import { getUnassignmentNotification } from './utils/assignments'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import {
  AuditLogAssignmentsImage,
  CaseLogMetaDataType,
} from '@/@types/audit-log'

type Payload = NotificationRawPayload<
  AuditLogAssignmentsImage,
  CaseLogMetaDataType
>

export class CaseUnassignment extends Subscriptions {
  type: NotificationType = 'CASE_UNASSIGNMENT'

  async toSend(payload: Payload): Promise<boolean> {
    return payload.type === 'CASE' && payload.subtype === 'ASSIGNMENT'
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    const result = getUnassignmentNotification(payload, 'CASE')
    return result
  }
}
