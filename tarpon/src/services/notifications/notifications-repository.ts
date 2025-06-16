import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { DynamoNotificationRepository } from './dynamo-repository'
import { ClickhouseNotificationRepository } from './clickhouse-repository'
import { ConsoleNotificationStatus } from '@/@types/openapi-internal/ConsoleNotificationStatus'
import { Notification } from '@/@types/openapi-internal/Notification'
import { traceable } from '@/core/xray'
import { NOTIFICATIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { cursorPaginate } from '@/utils/pagination'
import { NotificationListResponse } from '@/@types/openapi-internal/NotificationListResponse'
import { DefaultApiGetNotificationsRequest } from '@/@types/openapi-internal/RequestParameters'
import {
  batchInsertToClickhouse,
  getClickhouseClient,
  isClickhouseEnabledInRegion,
  isClickhouseMigrationEnabled,
} from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { getDynamoDbClient } from '@/utils/dynamodb'

@traceable
export class NotificationRepository {
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  tenantId: string
  dynamoNotificationRepository: DynamoNotificationRepository
  clickhouseNotificationRepository?: ClickhouseNotificationRepository
  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb?: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb =
      (connections.dynamoDb as DynamoDBDocumentClient) ?? getDynamoDbClient()
    this.dynamoNotificationRepository = new DynamoNotificationRepository(
      tenantId,
      this.dynamoDb
    )
  }
  private async getClickhouseNotificationRepository(): Promise<ClickhouseNotificationRepository> {
    if (this.clickhouseNotificationRepository) {
      return this.clickhouseNotificationRepository
    }
    const clickhouse = await getClickhouseClient(this.tenantId)
    this.clickhouseNotificationRepository =
      new ClickhouseNotificationRepository(this.tenantId, {
        clickhouseClient: clickhouse,
        dynamoDb: this.dynamoDb,
      })
    return this.clickhouseNotificationRepository
  }
  async addNotification(notification: Notification): Promise<Notification> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoNotificationRepository.saveToDynamoDb([notification])
    }
    const db = this.mongoDb.db()
    const notificationsCollection = db.collection<Notification>(
      NOTIFICATIONS_COLLECTION(this.tenantId)
    )

    await notificationsCollection.insertOne(notification)

    return notification
  }

  async updateConsoleNotification(
    notificationId: string,
    statuses: ConsoleNotificationStatus[]
  ): Promise<void> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoNotificationRepository.updateConsoleNotification(
        notificationId,
        statuses
      )
    }
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
    if (isClickhouseMigrationEnabled()) {
      const clickhouseNotificationRepository =
        await this.getClickhouseNotificationRepository()
      return await clickhouseNotificationRepository.getNotificationsByRecipient(
        recipient
      )
    }
    const db = this.mongoDb.db()
    const notificationsCollectionName = NOTIFICATIONS_COLLECTION(this.tenantId)

    const notificationsCollection = db.collection<Notification>(
      notificationsCollectionName
    )

    return notificationsCollection.find({ recievers: recipient }).toArray()
  }

  async getConsoleNotifications(
    accountId: string,
    params: DefaultApiGetNotificationsRequest
  ): Promise<NotificationListResponse> {
    if (isClickhouseMigrationEnabled()) {
      const clickhouseNotificationRepository =
        await this.getClickhouseNotificationRepository()
      const { items, next, prev, hasNext, hasPrev, count, limit, last } =
        await clickhouseNotificationRepository.getConsoleNotifications(
          accountId,
          params
        )
      const notifications =
        await this.dynamoNotificationRepository.getNotifications(items)
      return {
        items: notifications,
        next,
        prev,
        hasNext,
        hasPrev,
        count,
        limit,
        last,
      }
    }
    return this.getConsoleNotificationsCursorPaginate(accountId, params)
  }

  async markAllAsRead(accountId: string): Promise<void> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoNotificationRepository.markAllAsRead(accountId)
    }
    const db = this.mongoDb.db()
    const notificationsCollectionName = NOTIFICATIONS_COLLECTION(this.tenantId)

    const notificationsCollection = db.collection<Notification>(
      notificationsCollectionName
    )

    await notificationsCollection.updateMany(
      { recievers: accountId },
      { $set: { 'consoleNotificationStatuses.$[user].status': 'READ' } },
      { arrayFilters: [{ 'user.recieverUserId': accountId }] }
    )
  }

  async markAsRead(accountId: string, notificationId: string): Promise<void> {
    if (isClickhouseEnabledInRegion()) {
      await this.dynamoNotificationRepository.markAsRead(
        accountId,
        notificationId
      )
    }
    const db = this.mongoDb.db()
    const notificationsCollectionName = NOTIFICATIONS_COLLECTION(this.tenantId)

    const notificationsCollection = db.collection<Notification>(
      notificationsCollectionName
    )

    await notificationsCollection.updateOne(
      { id: notificationId, recievers: accountId },
      { $set: { 'consoleNotificationStatuses.$[user].status': 'READ' } },
      { arrayFilters: [{ 'user.recieverUserId': accountId }] }
    )
  }

  async getConsoleNotificationsCursorPaginate(
    accountId: string,
    params: DefaultApiGetNotificationsRequest
  ): Promise<{
    items: Notification[]
    next: string
    prev: string
    hasPrev: boolean
    hasNext: boolean
    count: number
    limit: number
    last: string
  }> {
    const db = this.mongoDb.db()
    const notificationsCollectionName = NOTIFICATIONS_COLLECTION(this.tenantId)

    const notificationsCollection = db.collection<Notification>(
      notificationsCollectionName
    )

    let notificationStatusQuery = {}
    if (params.notificationStatus === 'UNREAD') {
      notificationStatusQuery = {
        consoleNotificationStatuses: {
          $elemMatch: {
            recieverUserId: accountId,
            status: 'SENT',
          },
        },
      }
    }
    const result = await cursorPaginate<Notification>(
      notificationsCollection,
      {
        recievers: accountId,
        notificationChannel: 'CONSOLE',
        ...notificationStatusQuery,
      },
      {
        pageSize: 50,
        sortField: 'createdAt',
        fromCursorKey: params.start,
        sortOrder: 'descend',
      }
    )
    return result
  }

  public async linkNotificationsToClickhouse(
    notifications: Notification[]
  ): Promise<void> {
    await batchInsertToClickhouse(
      this.tenantId,
      CLICKHOUSE_DEFINITIONS.NOTIFICATIONS.tableName,
      notifications
    )
  }
}
