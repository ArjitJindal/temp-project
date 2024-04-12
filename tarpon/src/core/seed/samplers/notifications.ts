import { v4 as uuid } from 'uuid'
import { getRandomUser } from '../samplers/accounts'
import { getCases } from '../data/cases'
import { Case } from '@/@types/openapi-internal/Case'
import { Notification } from '@/@types/openapi-internal/Notification'
import { Alert } from '@/@types/openapi-internal/Alert'

type PartialNotification = Pick<
  Notification,
  | 'notificationData'
  | 'recievers'
  | 'consoleNotificationStatuses'
  | 'notificationChannel'
  | 'notificationType'
>

export const sampleNotifications = () => {
  const data: Notification[] = []
  const cases = getCases()

  cases.forEach((c) => {
    const userAccount = getRandomUser()
    if (c.caseStatus === 'OPEN' && c.assignments?.length) {
      data.push(
        createCaseNotification(
          userAccount.assigneeUserId,
          c,
          getAssignmentNotification(c, 'CASE')
        )
      )
    } else if (c.caseStatus === 'CLOSED') {
      data.push(
        createCaseNotification(
          userAccount.assigneeUserId,
          c,
          getStatusChangeNotification(c, 'CASE')
        )
      )
    }
    c.alerts?.forEach((a) => {
      const userAccount = getRandomUser()
      if (a.alertStatus === 'OPEN') {
        data.push(
          createAlertNotification(
            userAccount.assigneeUserId,
            a,
            getAssignmentNotification(a, 'ALERT')
          )
        )
      } else if (c.caseStatus === 'CLOSED') {
        data.push(
          createAlertNotification(
            userAccount.assigneeUserId,
            a,
            getStatusChangeNotification(c, 'ALERT')
          )
        )
      }
    })
  })

  return data
}

const createCaseNotification = (
  triggeredBy: string,
  entity: Case,
  notificationData: PartialNotification
): Notification => {
  return {
    id: uuid(),
    createdAt: Date.now(),
    triggeredBy,
    entityId: entity.caseId ?? 'C-1',
    entityType: 'CASE',
    ...notificationData,
  }
}

const createAlertNotification = (
  triggeredBy: string,
  entity: Alert,
  notificationData: PartialNotification
): Notification => {
  return {
    id: uuid(),
    createdAt: Date.now(),
    triggeredBy,
    entityId: entity.alertId ?? 'A-1',
    entityType: 'ALERT',
    ...notificationData,
  }
}

const getAssignmentNotification = (
  entity: Case | Alert,
  entityType: 'CASE' | 'ALERT'
): PartialNotification => {
  const assigneeUserIds = entity.assignments?.map((a) => a.assigneeUserId) ?? []
  return {
    notificationData: {
      type: 'ASSIGNMENT',
      assignments: assigneeUserIds,
    },
    consoleNotificationStatuses: assigneeUserIds.map((id) => ({
      status: 'SENT',
      stausUpdatedAt: Date.now(),
      recieverUserId: id,
    })),
    notificationChannel: 'CONSOLE',
    notificationType: `${entityType}_ASSIGNMENT`,
    recievers: assigneeUserIds,
    ...(entityType === 'ALERT'
      ? {
          metadata: {
            alert: {
              caseId: entity.caseId,
            },
          },
        }
      : {}),
  }
}

const getStatusChangeNotification = (
  entity: Case | Alert,
  entityType: 'CASE' | 'ALERT'
): PartialNotification => {
  const assigneeUserIds = entity.assignments?.map((a) => a.assigneeUserId) ?? []
  return {
    notificationData: {
      type: 'UPDATE',
      status: 'CLOSED',
    },
    consoleNotificationStatuses: assigneeUserIds.map((id) => ({
      status: 'SENT',
      stausUpdatedAt: Date.now(),
      recieverUserId: id,
    })),
    notificationType: `${entityType}_STATUS_UPDATE`,
    recievers: assigneeUserIds,
    notificationChannel: 'CONSOLE',
  }
}
