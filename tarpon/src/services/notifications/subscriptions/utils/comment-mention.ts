import { getEntityMetadata } from './commonUtils'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { Comment } from '@/@types/openapi-internal/Comment'
import { CommentMentionNotification } from '@/@types/openapi-internal/CommentMentionNotification'
import { Notification } from '@/@types/openapi-internal/Notification'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'

export const getCommentMentionNotification = (
  payload: NotificationRawPayload<Partial<Comment>, object>,
  type: 'ALERT' | 'CASE' | 'USER'
): PartialNotification<CommentMentionNotification> | undefined => {
  const { newImage } = payload
  const mentions = newImage?.mentions

  if (!mentions?.length) {
    return
  }

  const notification: Omit<Notification, 'notificationChannel' | 'id'> = {
    notificationType: `${type}_COMMENT_MENTION`,
    createdAt: Date.now(),
    entityId: payload.entityId,
    triggeredBy: payload.user?.id ?? FLAGRIGHT_SYSTEM_USER,
    entityType: type,
    recievers: mentions,
    notificationData: {
      type: 'COMMENT_MENTION',
      mentions: mentions,
    },
    metadata: getEntityMetadata(type, payload.logMetadata),
  }

  return notification
}

export const includesMentions = (comment?: Partial<Comment>): boolean => {
  return comment?.mentions?.length ? true : false
}
