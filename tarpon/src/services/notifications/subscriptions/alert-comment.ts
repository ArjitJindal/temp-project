import { CaseCommentPayload, getCommentNotification } from './utils/comment'
import { Subscriptions } from '.'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { PartialNotification } from '@/@types/notifications'

export class CaseComment extends Subscriptions {
  type: NotificationType = 'CASE_COMMENT'

  async toSend(payload: CaseCommentPayload): Promise<boolean> {
    return payload.type === 'CASE' && payload.subtype === 'COMMENT'
  }

  async getNotification(
    payload: CaseCommentPayload
  ): Promise<PartialNotification | undefined> {
    return getCommentNotification(payload, 'CASE')
  }
}
