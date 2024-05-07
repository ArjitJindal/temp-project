import { MongoClient } from 'mongodb'
import { compact, memoize } from 'lodash'
import { v4 as uuid } from 'uuid'
import { Account, AccountsService } from '../accounts'
import { RoleService } from '../roles'
import { NotificationsChannels } from './notifications-channels'
import { ConsoleNotifications } from './console-notifications'
import { NotificationRepository } from './notifications-repository'
import { AlertAssignees } from './subscriptions/alert-assignment'
import { CaseAssignees } from './subscriptions/case-assignments'
import { Subscriptions } from './subscriptions'
import { CaseUnassignment } from './subscriptions/case-unassignment'
import { AlertUnassignment } from './subscriptions/alert-unassignment'
import { CaseEscalation } from './subscriptions/case-escalation'
import { AlertEscalations } from './subscriptions/alert-escalation'
import { AlertCommentMention } from './subscriptions/alert-comment-mention'
import { CaseCommentMention } from './subscriptions/case-comment-mention'
import { UserCommentMention } from './subscriptions/user-comment-mention'
import { AlertInReview } from './subscriptions/alert-in-review'
import { CaseInReview } from './subscriptions/case-in-review'
import { CaseComment } from './subscriptions/alert-comment'
import { AlertComment } from './subscriptions/case-comment'
import { AlertStatusUpdate } from './subscriptions/alert-status-update'
import { CaseStatusUpdate } from './subscriptions/case-status-update'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { Notification } from '@/@types/openapi-internal/Notification'
import { traceable } from '@/core/xray'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { Permission } from '@/@types/openapi-internal/Permission'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'

@traceable
export class NotificationsService {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, connections: { mongoDb: MongoClient }) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
  }

  private allUsers = memoize(async () => {
    const accountsService = await AccountsService.getInstance()
    const tenant = await accountsService.getTenantById(this.tenantId)
    if (!tenant) {
      throw new Error('Tenant not found')
    }
    return accountsService.getTenantAccounts(tenant)
  })

  private allRoles = memoize(
    async () => await RoleService.getInstance().getTenantRoles(this.tenantId)
  )

  private roleById = memoize(
    async (roleId: string) => await RoleService.getInstance().getRole(roleId),
    (roleId) => roleId
  )

  private async getAllUsers(): Promise<Account[]> {
    return await this.allUsers()
  }

  private async getAllRoles(): Promise<AccountRole[]> {
    return await this.allRoles()
  }

  private async getRoleById(roleId: string): Promise<AccountRole> {
    return await this.roleById(roleId)
  }

  private async getNotifications(
    payload: NotificationRawPayload
  ): Promise<PartialNotification[]> {
    const notifications: PartialNotification[] = []

    const subscriptions: Subscriptions[] = [
      new AlertAssignees(),
      new CaseAssignees(),
      new CaseUnassignment(),
      new AlertUnassignment(),
      new CaseEscalation(),
      new AlertEscalations(),
      new AlertCommentMention(),
      new CaseCommentMention(),
      new UserCommentMention(),
      new CaseInReview(),
      new AlertInReview(),
      new CaseComment(),
      new AlertComment(),
      new AlertStatusUpdate(),
      new CaseStatusUpdate(),
    ]

    for (const subscription of subscriptions) {
      if (await subscription.toSend(payload)) {
        const notification = await subscription.getNotification(payload)
        if (notification) {
          notifications.push(notification)
        }
      }
    }

    return notifications
  }

  private isNotificationSubscribed(
    channel: NotificationsChannels,
    notificationType: NotificationType
  ): boolean {
    return channel.subscribedNotificationTypes().includes(notificationType)
  }

  private async validateRBAC(
    recipientId: string,
    notificationType: NotificationType
  ): Promise<boolean> {
    const notificationTypeToPermission: Record<NotificationType, Permission[]> =
      {
        ALERT_ASSIGNMENT: ['case-management:case-overview:read'],
        CASE_ASSIGNMENT: ['case-management:case-overview:read'],
        CASE_UNASSIGNMENT: ['case-management:case-overview:read'],
        ALERT_UNASSIGNMENT: ['case-management:case-overview:read'],
        CASE_ESCALATION: ['case-management:case-overview:read'],
        ALERT_ESCALATION: ['case-management:case-overview:read'],
        ALERT_COMMENT_MENTION: ['case-management:case-details:read'],
        CASE_COMMENT_MENTION: ['case-management:case-details:read'],
        USER_COMMENT_MENTION: ['users:user-details:read'],
        ALERT_IN_REVIEW: ['case-management:case-overview:read'],
        CASE_IN_REVIEW: ['case-management:case-overview:read'],
        ALERT_COMMENT: ['case-management:case-details:read'],
        CASE_COMMENT: ['case-management:case-details:read'],
        ALERT_STATUS_UPDATE: ['case-management:case-overview:read'],
        CASE_STATUS_UPDATE: ['case-management:case-overview:read'],
      }

    const [allUsers, allRoles] = await Promise.all([
      this.getAllUsers(),
      this.getAllRoles(),
    ])

    const recipient = allUsers.find((user) => user.id === recipientId)

    if (!recipient) {
      return false
    }

    const role = allRoles.find((role) => role.name === recipient.role)

    if (!role) {
      return false
    }

    const permissionsRequired = notificationTypeToPermission[notificationType]

    if (!permissionsRequired) {
      return false
    }

    const rolePermissions = (await this.getRoleById(role.id)).permissions

    const isAllPermissions = permissionsRequired.every((permission) =>
      rolePermissions.includes(permission)
    )

    return isAllPermissions
  }

  private async getFinalRecievers(
    notification: PartialNotification
  ): Promise<string[]> {
    const recievers = notification.recievers

    const validRecievers = await Promise.all(
      recievers.map(async (reciever) => {
        if (reciever === notification.triggeredBy) {
          return null
        }

        const isValid = await this.validateRBAC(
          reciever,
          notification.notificationType
        )
        return isValid ? reciever : null
      })
    )

    return compact(validRecievers)
  }

  public async handleNotification(payload: AuditLog): Promise<void> {
    const notifications = await this.getNotifications(
      payload as NotificationRawPayload
    )

    const notificationRepository = new NotificationRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    if (notifications.length === 0) {
      return
    }

    const notificationChannels: NotificationsChannels[] = [
      new ConsoleNotifications(this.tenantId, { mongoDb: this.mongoDb }),
    ]

    for (const notification of notifications) {
      for (const channel of notificationChannels) {
        if (
          this.isNotificationSubscribed(channel, notification.notificationType)
        ) {
          const finalRecievers = await this.getFinalRecievers(notification)

          if (finalRecievers.length === 0) {
            continue
          }

          const notificationObj: Notification = {
            ...notification,
            id: uuid(),
            notificationChannel: channel.channel,
            recievers: finalRecievers,
          }

          await notificationRepository.addNotification(notificationObj)

          await channel.send(notificationObj)
        }
      }
    }
  }
}
