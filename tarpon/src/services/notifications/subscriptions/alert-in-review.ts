import {
  AlertInReviewPayload,
  getUpdateNotification,
} from './utils/in-review-notification'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { PartialNotification } from '@/@types/notifications'
import { isStatusInReview } from '@/utils/helpers'

export class AlertInReview extends Subscriptions {
  type: NotificationType = 'ALERT_IN_REVIEW'

  async toSend(payload: AlertInReviewPayload): Promise<boolean> {
    return (
      payload.type === 'ALERT' &&
      payload.subtype === 'STATUS_CHANGE' &&
      payload.action === 'UPDATE' &&
      isStatusInReview(payload.newImage?.alertStatus)
    )
  }

  async getNotification(
    payload: AlertInReviewPayload
  ): Promise<PartialNotification | undefined> {
    return getUpdateNotification(payload, 'ALERT')
  }
}
