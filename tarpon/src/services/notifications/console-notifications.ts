import { NotificationsChannels } from './notifications-channels'
import { NotificationRepository } from './notifications-repository'
import { Notification } from '@/@types/openapi-internal/Notification'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { getContext } from '@/core/utils/context'
import { ConsoleNotificationStatus } from '@/@types/openapi-internal/ConsoleNotificationStatus'

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
}
