import { v4 as uuid } from 'uuid'
import { getAccounts } from '../samplers/accounts'
import { getCases } from '../data/cases'
import { NOTIFICATIONS_SEED } from '../data/seeds'
import { RandomNumberGenerator } from './prng'
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
  const accounts = getAccounts()

  const casesRng = new RandomNumberGenerator(NOTIFICATIONS_SEED)
  const alertsRng = new RandomNumberGenerator(casesRng.randomInt())

  cases.forEach((c) => {
    const userAccount = casesRng.pickRandom(accounts)
    casesRng.setSeed(casesRng.getSeed() + 1) // increment seed for next user

    if (c.caseStatus === 'OPEN' && c.assignments?.length) {
      data.push(
        createCaseNotification(
          userAccount.id,
          c,
          getAssignmentNotification(c, 'CASE')
        )
      )
    } else if (c.caseStatus === 'CLOSED') {
      data.push(
        createCaseNotification(
          userAccount.id,
          c,
          getStatusChangeNotification(c, 'CASE')
        )
      )
    }
    c.alerts?.forEach((a) => {
      const userAccount = alertsRng.pickRandom(accounts)
      alertsRng.setSeed(alertsRng.getSeed() + 1) // increment seed for next user

      if (a.alertStatus === 'OPEN') {
        data.push(
          createAlertNotification(
            userAccount.id,
            a,
            getAssignmentNotification(a, 'ALERT')
          )
        )
      } else if (c.caseStatus === 'CLOSED') {
        data.push(
          createAlertNotification(
            userAccount.id,
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
