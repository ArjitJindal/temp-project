import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { StackConstants } from '@lib/constants'
import {
  UpdateCommand,
  QueryCommand,
  QueryCommandOutput,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { omit } from 'lodash'
import { traceable } from '@/core/xray'
import { Notification } from '@/@types/openapi-internal/Notification'
import {
  batchGet,
  sanitizeMongoObject,
  DynamoTransactionBatch,
} from '@/utils/dynamodb'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { ConsoleNotificationStatus } from '@/@types/openapi-internal/ConsoleNotificationStatus'
import { envIs } from '@/utils/env'

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKey: { PartitionKeyID: string; SortKeyID?: string }[]
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  for (const key of primaryKey) {
    await localTarponChangeCaptureHandler(tenantId, key, 'TARPON')
  }
}

@traceable
export class DynamoNotificationRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBClient
  private readonly tableName: string

  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async saveToDynamoDb(notifications: Notification[]) {
    const keys: { PartitionKeyID: string; SortKeyID?: string }[] = []

    // Create document client and batch for operations
    const docClient = DynamoDBDocumentClient.from(this.dynamoDb, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    })
    const batch = new DynamoTransactionBatch(docClient, this.tableName)

    for (const notification of notifications) {
      if (!notification.id) {
        continue
      }
      const key = DynamoDbKeys.NOTIFICATIONS(this.tenantId, notification.id)
      keys.push(key)

      batch.put({
        Item: {
          ...key,
          ...sanitizeMongoObject(notification),
        },
      })
    }

    await batch.execute()
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, keys)
    }
  }

  public async updateConsoleNotification(
    notificationId: string,
    statuses: ConsoleNotificationStatus[]
  ): Promise<void> {
    const key = DynamoDbKeys.NOTIFICATIONS(this.tenantId, notificationId)

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'SET consoleNotificationStatuses = :statuses',
      ExpressionAttributeValues: {
        ':statuses': statuses,
      },
    })

    await this.dynamoDb.send(command)

    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
  }
  public async getNotifications(
    notificationIds: string[]
  ): Promise<Notification[]> {
    const notifications = await batchGet<Notification>(
      this.dynamoDb,
      this.tableName,
      notificationIds.map((notificationId) =>
        DynamoDbKeys.NOTIFICATIONS(this.tenantId, notificationId)
      )
    )
    const notificationMap = notifications.reduce((acc, item) => {
      const notificationId = item.id
      acc[notificationId] = omit(item, [
        'PartitionKeyID',
        'SortKeyID',
      ]) as Notification
      return acc
    }, {} as Record<string, Notification>)
    return notificationIds.map((id) => notificationMap[id]).filter(Boolean)
  }
  public async markAllAsRead(accountId: string): Promise<void> {
    const notificationsToUpdate: Notification[] = []
    let exclusiveStartKey: Record<string, any> | undefined = undefined
    const key = DynamoDbKeys.NOTIFICATIONS(this.tenantId, '')
    do {
      const queryCommand = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': key.PartitionKeyID,
        },
        ProjectionExpression: 'id, consoleNotificationStatuses',
        ExclusiveStartKey: exclusiveStartKey,
      })

      const result = (await this.dynamoDb.send(
        queryCommand
      )) as QueryCommandOutput
      const items = (result.Items || []) as Notification[]

      const filteredItems = items.filter((item) =>
        item.consoleNotificationStatuses?.some(
          (statusEntry) => statusEntry.recieverUserId === accountId
        )
      )

      notificationsToUpdate.push(...filteredItems)
      exclusiveStartKey = result.LastEvaluatedKey
    } while (exclusiveStartKey)

    for (const notification of notificationsToUpdate) {
      if (!notification.consoleNotificationStatuses) {
        continue
      }

      const userIndex = notification.consoleNotificationStatuses.findIndex(
        (userStatus) => userStatus.recieverUserId === accountId
      )

      const notificationKey = DynamoDbKeys.NOTIFICATIONS(
        this.tenantId,
        notification.id
      )
      if (userIndex !== -1) {
        const updateCommand = new UpdateCommand({
          TableName: this.tableName,
          Key: notificationKey,
          UpdateExpression: `SET consoleNotificationStatuses[${userIndex}].#statusAttr = :readStatus`,
          ExpressionAttributeNames: {
            '#statusAttr': 'status',
          },
          ExpressionAttributeValues: {
            ':readStatus': 'READ',
          },
          ReturnValues: 'UPDATED_NEW',
        })

        await this.dynamoDb.send(updateCommand)
      }
    }
  }
  public async markAsRead(
    accountId: string,
    notificationId: string
  ): Promise<void> {
    const key = DynamoDbKeys.NOTIFICATIONS(this.tenantId, notificationId)
    const getCommand = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PartitionKeyID = :pk AND SortKeyID = :sk',
      FilterExpression: 'contains(recievers, :accountId)',
      ExpressionAttributeValues: {
        ':pk': key.PartitionKeyID,
        ':sk': key.SortKeyID,
        ':accountId': accountId,
      },
    })
    const result = await this.dynamoDb.send(getCommand)
    const notification = result.Items?.[0] as Notification
    if (!notification?.consoleNotificationStatuses) {
      return
    }
    const statusIndex = notification.consoleNotificationStatuses.findIndex(
      (status) => status.recieverUserId === accountId
    )
    if (statusIndex >= 0) {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: `SET consoleNotificationStatuses[${statusIndex}].#status = :readStatus`,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':readStatus': 'READ',
        },
      })
      await this.dynamoDb.send(command)
      if (envIs('local') || envIs('test')) {
        await handleLocalChangeCapture(this.tenantId, [key])
      }
    }
  }
}
