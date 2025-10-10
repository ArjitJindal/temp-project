import { getEntityMetadata } from './commonUtils'
import {
  AlertLogMetaDataType,
  CaseLogMetaDataType,
  CommentAuditLogImage,
} from '@/@types/audit-log'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CommentNotification } from '@/@types/openapi-internal/CommentNotification'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { shouldUseReviewAssignments } from '@/utils/helpers'

export type AlertCommentPayload = NotificationRawPayload<
  CommentAuditLogImage,
  AlertLogMetaDataType
>

export type CaseCommentPayload = NotificationRawPayload<
  CommentAuditLogImage,
  CaseLogMetaDataType
>

export const getCommentNotification = (
  payload: AlertCommentPayload | CaseCommentPayload,
  type: 'ALERT' | 'CASE'
) => {
  const { newImage, logMetadata } = payload
  const comment = newImage

  if (!comment) {
    return
  }

  let status: CaseStatus | undefined

  if (type === 'ALERT') {
    status = (logMetadata as AlertLogMetaDataType)?.alertStatus
  } else {
    status = (logMetadata as CaseLogMetaDataType)?.caseStatus
  }

  let recievers: string[] = []

  if (shouldUseReviewAssignments(status)) {
    recievers =
      logMetadata?.reviewAssignments?.map(
        (assignment) => assignment.assigneeUserId
      ) ?? []
  } else {
    recievers =
      type === 'ALERT'
        ? (logMetadata as AlertLogMetaDataType)?.alertAssignment?.map(
            (assignment) => assignment.assigneeUserId
          ) ?? []
        : (logMetadata as CaseLogMetaDataType)?.caseAssignment?.map(
            (assignment) => assignment.assigneeUserId
          ) ?? []
  }
  if (!recievers.length) {
    return
  }

  const notification: PartialNotification<CommentNotification> = {
    notificationType: `${type}_COMMENT`,
    createdAt: Date.now(),
    entityId: payload.entityId,
    triggeredBy: payload.user?.id || FLAGRIGHT_SYSTEM_USER,
    entityType: type,
    recievers,
    notificationData: {
      type: 'COMMENT',
      comment,
    },
    metadata: getEntityMetadata(type, payload.logMetadata),
  }
  return notification
}
