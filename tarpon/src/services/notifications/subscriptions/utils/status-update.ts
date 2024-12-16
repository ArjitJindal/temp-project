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
import { UpdateNotification } from '@/@types/openapi-internal/UpdateNotification'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'
import { shouldUseReviewAssignments } from '@/utils/helpers'

export type CaseStatusUpdatePayload = NotificationRawPayload<
  CaseUpdateAuditLogImage,
  CaseLogMetaDataType
>

export type AlertStatusUpdatePayload = NotificationRawPayload<
  AlertUpdateAuditLogImage,
  AlertLogMetaDataType
>

export const getStatusUpdateNotification = (
  payload: CaseStatusUpdatePayload | AlertStatusUpdatePayload,
  type: 'ALERT' | 'CASE'
): PartialNotification<UpdateNotification> | undefined => {
  const status =
    type === 'CASE'
      ? (payload as CaseStatusUpdatePayload)?.newImage?.caseStatus
      : (payload as AlertStatusUpdatePayload)?.newImage?.alertStatus
  const oldStatus =
    type === 'CASE'
      ? (payload as CaseStatusUpdatePayload)?.oldImage?.caseStatus
      : (payload as AlertStatusUpdatePayload)?.oldImage?.alertStatus
  if (!status) {
    return
  }

  const recievers: string[] =
    (shouldUseReviewAssignments(status)
      ? payload.oldImage?.reviewAssignments
      : payload.oldImage?.assignments
    )?.map((assignment) => assignment.assigneeUserId) || []

  return {
    createdAt: Date.now(),
    entityId: payload.entityId,
    entityType: type,
    notificationType: `${type}_STATUS_UPDATE`,
    recievers,
    triggeredBy: payload.user?.id || FLAGRIGHT_SYSTEM_USER,
    notificationData: { type: 'UPDATE', status, oldStatus },
    metadata: getEntityMetadata(type, payload.logMetadata),
  }
}
