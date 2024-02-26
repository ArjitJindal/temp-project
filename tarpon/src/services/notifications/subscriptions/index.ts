import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'

export abstract class Subscriptions {
  abstract type: NotificationType

  abstract toSend(payload: NotificationRawPayload): Promise<boolean>

  abstract getNotification(
    payload: NotificationRawPayload
  ): Promise<PartialNotification | undefined>
}
