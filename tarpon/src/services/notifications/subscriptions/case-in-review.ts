import {
  CaseInReviewPayload,
  getUpdateNotification,
} from './utils/in-review-notification'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { PartialNotification } from '@/@types/notifications'
import { isStatusInReview } from '@/utils/helpers'

export class CaseInReview extends Subscriptions {
  type: NotificationType = 'CASE_IN_REVIEW'

  async toSend(payload: CaseInReviewPayload): Promise<boolean> {
    return (
      payload.type === 'CASE' &&
      payload.subtype === 'STATUS_CHANGE' &&
      payload.action === 'UPDATE' &&
      isStatusInReview(payload.newImage?.caseStatus)
    )
  }

  async getNotification(
    payload: CaseInReviewPayload
  ): Promise<PartialNotification | undefined> {
    return getUpdateNotification(payload, 'CASE')
  }
}
