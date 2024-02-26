import { MongoClient } from 'mongodb'
import { ConsoleNotificationStatus } from '@/@types/openapi-internal/ConsoleNotificationStatus'
import { Notification } from '@/@types/openapi-internal/Notification'
import { traceable } from '@/core/xray'
import { NOTIFICATIONS_COLLECTION } from '@/utils/mongodb-definitions'

@traceable
export class NotificationRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(tenantId: string, connections: { mongoDb: MongoClient }) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
  }

  async addNotification(notification: Notification): Promise<void> {
    const db = this.mongoDb.db()
    const notificationsCollection = db.collection<Notification>(
      NOTIFICATIONS_COLLECTION(this.tenantId)
    )

    await notificationsCollection.insertOne(notification)
  }

  async updateConsoleNotification(
    notificationId: string,
    statuses: ConsoleNotificationStatus[]
  ): Promise<void> {
    const db = this.mongoDb.db()
    const notificationsCollectionName = NOTIFICATIONS_COLLECTION(this.tenantId)
    const notificationsCollection = db.collection<Notification>(
      notificationsCollectionName
    )

    await notificationsCollection.updateOne(
      { id: notificationId },
      { $set: { consoleNotificationStatuses: statuses } }
    )
  }
  async getNotificationsByRecipient(
    recipient: string
  ): Promise<Notification[]> {
    const db = this.mongoDb.db()
    const notificationsCollectionName = NOTIFICATIONS_COLLECTION(this.tenantId)

    const notificationsCollection = db.collection<Notification>(
      notificationsCollectionName
    )

    return notificationsCollection.find({ recievers: recipient }).toArray()
  }
}
