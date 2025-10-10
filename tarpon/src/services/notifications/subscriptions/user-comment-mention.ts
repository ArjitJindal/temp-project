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

export class UserCommentMention extends Subscriptions {
  type: NotificationType = 'USER_COMMENT_MENTION'

  async toSend(payload: Payload): Promise<boolean> {
    return (
      payload.type === 'USER' &&
      payload.subtype === 'COMMENT' &&
      includesMentions(payload.newImage)
    )
  }

  async getNotification(
    payload: Payload
  ): Promise<PartialNotification | undefined> {
    return getCommentMentionNotification(payload, 'USER')
  }
}
