import { getEntityMetadata } from './commonUtils'
import {
  AlertLogMetaDataType,
  AlertUpdateAuditLogImage,
  CaseLogMetaDataType,
  CaseUpdateAuditLogImage,
} from '@/@types/audit-log'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { UpdateNotification } from '@/@types/openapi-internal/UpdateNotification'

export type CaseInReviewPayload = NotificationRawPayload<
  CaseUpdateAuditLogImage,
  CaseLogMetaDataType
>

export type AlertInReviewPayload = NotificationRawPayload<
  AlertUpdateAuditLogImage,
  AlertLogMetaDataType
>

export const getUpdateNotification = (
  payload: CaseInReviewPayload | AlertInReviewPayload,
  type: 'ALERT' | 'CASE'
): PartialNotification<UpdateNotification> | undefined => {
  const reviewAssignments = payload.newImage?.reviewAssignments

  let status: CaseStatus | undefined

  if (type === 'CASE') {
    status = (payload as CaseInReviewPayload).newImage?.caseStatus
  } else {
    status = (payload as AlertInReviewPayload).newImage?.alertStatus
  }

  if (!reviewAssignments?.length || !status) {
    return
  }

  const recievers = reviewAssignments.map(
    (assignment) => assignment.assigneeUserId
  )

  const notification: PartialNotification<UpdateNotification> = {
    createdAt: Date.now(),
    entityId: payload.entityId,
    entityType: type,
    notificationType: `${type}_IN_REVIEW`,
    recievers,
    triggeredBy: payload.user?.id || 'FLAGRIGHT_SYSTEM_USER',
    notificationData: { type: 'UPDATE', status },
    metadata: getEntityMetadata(type, payload.logMetadata),
  }

  return notification
}
