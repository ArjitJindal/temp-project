import { NotificationsChannels } from './notifications-channels'
import { NotificationRepository } from './notifications-repository'
import { Notification } from '@/@types/openapi-internal/Notification'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { getContext } from '@/core/utils/context-storage'
import { ConsoleNotificationStatus } from '@/@types/openapi-internal/ConsoleNotificationStatus'
import { NotificationListResponse } from '@/@types/openapi-internal/NotificationListResponse'
import { DefaultApiGetNotificationsRequest } from '@/@types/openapi-internal/RequestParameters'

export class ConsoleNotifications extends NotificationsChannels {
  channel = 'CONSOLE' as const

  private getNotificationRepository() {
    return new NotificationRepository(this.tenantId, { mongoDb: this.mongoDb })
  }

  async send(notification: Notification): Promise<void> {
    const notificationRecipient = notification.recievers
    const notificationRepository = this.getNotificationRepository()

    const statuses: ConsoleNotificationStatus[] = notificationRecipient.map(
      (recieverUserId) => {
        return {
          recieverUserId: recieverUserId,
          status: 'SENT',
          stausUpdatedAt: Date.now(),
        }
      }
    )

    await notificationRepository.updateConsoleNotification(
      notification.id,
      statuses
    )
  }

  subscribedNotificationTypes(): NotificationType[] {
    const subscribedNotifications =
      getContext()?.settings?.notificationsSubscriptions?.console || []

    return subscribedNotifications
  }

  public async getConsoleNotifications(
    accountId: string,
    params: DefaultApiGetNotificationsRequest
  ): Promise<NotificationListResponse> {
    const notificationRepository = this.getNotificationRepository()

    const data = await notificationRepository.getConsoleNotifications(
      accountId,
      params
    )

    const filteredNotifications = data.items.map((notification) => {
      const recievers = notification.recievers.filter(
        (reciever) => reciever === accountId
      )

      const consoleNotificationStatuses =
        notification?.consoleNotificationStatuses?.filter(
          (status) => status.recieverUserId === accountId
        )

      return {
        ...notification,
        recievers,
        consoleNotificationStatuses,
      }
    })

    return {
      ...data,
      items: filteredNotifications,
    }
  }

  public async markAsRead(accountId: string, notificationId: string) {
    const notificationRepository = this.getNotificationRepository()

    await notificationRepository.markAsRead(accountId, notificationId)
  }

  public async markAllAsRead(accountId: string) {
    const notificationRepository = this.getNotificationRepository()

    await notificationRepository.markAllAsRead(accountId)
  }
}
