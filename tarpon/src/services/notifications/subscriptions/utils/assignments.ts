import { getEntityMetadata } from './commonUtils'
import {
  AlertLogMetaDataType,
  AuditLogAssignmentsImage,
  CaseLogMetaDataType,
} from '@/@types/audit-log'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { AssignmentNotification } from '@/@types/openapi-internal/AssignmentNotification'
import { Notification } from '@/@types/openapi-internal/Notification'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/alerts/repository'

export const getAssignmentNotification = (
  payload: NotificationRawPayload<
    AuditLogAssignmentsImage,
    AlertLogMetaDataType | CaseLogMetaDataType
  >,
  type: 'ALERT' | 'CASE'
): PartialNotification<AssignmentNotification> | undefined => {
  const { newImage, oldImage } = payload

  const newAssignments = newImage?.assignments || []
  const oldAssignments = oldImage?.assignments || []

  const newAssignmentIds = newAssignments.map(
    (assignment) => assignment.assigneeUserId
  )

  const oldAssignmentIds = oldAssignments.map(
    (assignment) => assignment.assigneeUserId
  )

  const addedAssignments = newAssignments.filter(
    (assignment) => !oldAssignmentIds.includes(assignment.assigneeUserId)
  )

  if (addedAssignments.length === 0) {
    return
  }

  const notification: Omit<Notification, 'notificationChannel' | 'id'> = {
    notificationType: `${type}_ASSIGNMENT`,
    createdAt: Date.now(),
    entityId: payload.entityId,
    triggeredBy: payload.user?.id ?? FLAGRIGHT_SYSTEM_USER,
    entityType: type,
    recievers: newAssignmentIds,
    notificationData: {
      type: 'ASSIGNMENT',
      assignments: newAssignments,
    },
    metadata: getEntityMetadata(type, payload.logMetadata),
  }

  return notification
}

export const getUnassignmentNotification = (
  payload: NotificationRawPayload<
    AuditLogAssignmentsImage,
    AlertLogMetaDataType | CaseLogMetaDataType
  >,
  type: 'ALERT' | 'CASE'
): PartialNotification<AssignmentNotification> | undefined => {
  const { newImage, oldImage } = payload

  const newAssignments = newImage?.assignments || []
  const oldAssignments = oldImage?.assignments || []

  const newAssignmentIds = newAssignments.map(
    (assignment) => assignment.assigneeUserId
  )

  const removedAssignments = oldAssignments.filter(
    (assignment) => !newAssignmentIds.includes(assignment.assigneeUserId)
  )

  if (removedAssignments.length === 0) {
    return
  }

  const notification: Omit<Notification, 'notificationChannel' | 'id'> = {
    notificationType: `${type}_UNASSIGNMENT`,
    createdAt: Date.now(),
    entityId: payload.entityId,
    triggeredBy: payload.user?.id ?? FLAGRIGHT_SYSTEM_USER,
    entityType: type,
    recievers: removedAssignments.map(
      (assignment) => assignment.assigneeUserId
    ),
    notificationData: {
      type: 'ASSIGNMENT',
      assignments: removedAssignments,
    },
    metadata: getEntityMetadata(type, payload.logMetadata),
  }

  return notification
}
