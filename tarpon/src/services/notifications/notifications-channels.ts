import { MongoClient } from 'mongodb'
import { Notification } from '@/@types/openapi-internal/Notification'
import { NotificationChannels } from '@/@types/openapi-internal/NotificationChannels'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { traceable } from '@/core/xray'

@traceable
export abstract class NotificationsChannels {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, connections: { mongoDb: MongoClient }) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
  }

  abstract channel: NotificationChannels

  abstract send(notification: Notification): Promise<void>

  abstract subscribedNotificationTypes(): NotificationType[]
}
