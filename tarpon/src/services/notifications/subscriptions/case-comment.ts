import { AlertCommentPayload, getCommentNotification } from './utils/comment'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { PartialNotification } from '@/@types/notifications'

export class AlertComment extends Subscriptions {
  type: NotificationType = 'ALERT_COMMENT'

  async toSend(payload: AlertCommentPayload): Promise<boolean> {
    return payload.type === 'ALERT' && payload.subtype === 'COMMENT'
  }

  async getNotification(
    payload: AlertCommentPayload
  ): Promise<PartialNotification | undefined> {
    return getCommentNotification(payload, 'ALERT')
  }
}
