import { AuditLog } from '../openapi-internal/AuditLog'
import { Notification } from '../openapi-internal/Notification'

export interface NotificationRawPayload<I = object, M = object>
  extends Omit<AuditLog, 'newImage' | 'oldImage' | 'logMetaData' | 'entityId'> {
  newImage?: I
  oldImage?: I
  logMetadata?: M
  entityId: string
}

export interface PartialNotification
  extends Omit<Notification, 'notificationChannel' | 'id'> {}
