import { AssignmentNotification } from '../openapi-internal/AssignmentNotification'
import { AuditLog } from '../openapi-internal/AuditLog'
import { EscalationNotification } from '../openapi-internal/EscalationNotification'
import { UpdateNotification } from '../openapi-internal/UpdateNotification'
import { Notification } from '../openapi-internal/Notification'

export interface NotificationRawPayload<I = object, M = object>
  extends Omit<AuditLog, 'newImage' | 'oldImage' | 'logMetaData' | 'entityId'> {
  newImage?: I
  oldImage?: I
  logMetadata?: M
  entityId: string
}

export type NotificationData =
  | AssignmentNotification
  | EscalationNotification
  | CommentMentionNotification
  | UpdateNotification

export interface PartialNotification<T extends NotificationData = object>
  extends Omit<
    Notification,
    'notificationChannel' | 'id' | 'notificationData'
  > {
  notificationData: T
}
