import {
  getCommentMentionNotification,
  includesMentions,
} from './utils/comment-mention'
import { Subscriptions } from '.'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { Comment } from '@/@types/openapi-internal/Comment'

type Payload = NotificationRawPayload<Partial<Comment>, object>

export class CaseCommentMention extends Subscriptions {
  type: NotificationType = 'CASE_COMMENT_MENTION'

  async toSend(payload: Payload): Promise<boolean> {
    return (
      payload.type === 'CASE' &&
      payload.subtype === 'COMMENT' &&
      includesMentions(payload.newImage)
    )
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    return getCommentMentionNotification(payload, 'CASE')
  }
}
