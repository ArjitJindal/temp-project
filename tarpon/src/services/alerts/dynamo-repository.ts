import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { v4 as uuidv4 } from 'uuid'
import { Alert } from '@/@types/openapi-internal/Alert'
import { Assignment } from '@/@types/openapi-internal/Assignment'
import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { Comment } from '@/@types/openapi-internal/Comment'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { batchGet, batchWrite } from '@/utils/dynamodb'
import { runLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'

export class DynamoAlertRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBClient

  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
  }

  public async saveComment(alertId: string, comment: Comment): Promise<string> {
    const now = Date.now()
    const commentId = comment.id || uuidv4()
    const item: Comment = {
      ...comment,
      id: commentId,
      createdAt: comment.createdAt ?? now,
      updatedAt: now,
    }

    const key = DynamoDbKeys.ALERT_COMMENT(this.tenantId, alertId, commentId)

    await Promise.all([
      this.dynamoDb.send(
        new PutCommand({
          TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
          Item: { ...key, ...item },
        })
      ),
      ...(comment.files ?? []).map(async (file) => {
        const fileKey = DynamoDbKeys.ALERT_COMMENT_FILE(
          this.tenantId,
          alertId,
          commentId,
          file.s3Key
        )

        await this.dynamoDb.send(
          new PutCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
            Item: { ...fileKey, ...file },
          })
        )

        await this.localChangeHandler(fileKey)
      }),
    ])

    await this.localChangeHandler(key)

    return commentId
  }

  public async saveAlertsComment(
    alertIds: string[],
    comment: Comment
  ): Promise<void> {
    const now = Date.now()
    const commentId = comment.id || uuidv4()
    const item: Comment = {
      ...comment,
      id: commentId,
      createdAt: comment.createdAt ?? now,
      updatedAt: now,
    }

    await batchWrite(
      this.dynamoDb,
      alertIds.map((alertId) => ({
        PutRequest: {
          Item: {
            ...DynamoDbKeys.ALERT_COMMENT(this.tenantId, alertId, commentId),
            ...item,
          },
        },
      })),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )
  }

  public async updateAISummary(
    alertId: string,
    commentId: string,
    fileS3Key: string,
    summary: string
  ): Promise<void> {
    const key = DynamoDbKeys.ALERT_COMMENT_FILE(
      this.tenantId,
      alertId,
      commentId,
      fileS3Key
    )

    await this.dynamoDb.send(
      new UpdateCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: key,
        UpdateExpression: 'set aiSummary = :summary',
        ExpressionAttributeValues: {
          ':summary': summary,
        },
      })
    )

    await this.localChangeHandler(key)
  }

  public async saveAlerts(alerts: Alert[]): Promise<void> {
    const modifiedAlerts = alerts.map((alert) => {
      delete alert.comments
      return alert
    })

    await batchWrite(
      this.dynamoDb,
      modifiedAlerts.map((alert) => ({
        PutRequest: {
          Item: {
            ...DynamoDbKeys.ALERT(this.tenantId, alert.alertId as string),
            ...alert,
          },
        },
      })),
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    )
  }

  public async saveAlert(alert: Alert): Promise<void> {
    const alertId = alert.alertId as string
    const key = DynamoDbKeys.ALERT(this.tenantId, alertId)

    delete alert.comments

    await this.dynamoDb.send(
      new PutCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Item: {
          ...key,
          ...alert,
        },
      })
    )

    await this.localChangeHandler(key)
  }

  public async deleteComment(
    alertId: string,
    commentId: string
  ): Promise<void> {
    const key = DynamoDbKeys.ALERT_COMMENT(this.tenantId, alertId, commentId)

    await this.dynamoDb.send(
      new DeleteCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        Key: key,
      })
    )

    const queryCommandResult = await this.dynamoDb.send(
      new QueryCommand({
        TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
        KeyConditionExpression: 'PartitionKeyID = :pk',
        ExpressionAttributeValues: {
          ':pk': DynamoDbKeys.ALERT_COMMENT(this.tenantId, alertId, commentId)
            .PartitionKeyID,
        },
      })
    )

    if (!queryCommandResult?.Items?.length) {
      return
    }

    await Promise.all(
      queryCommandResult?.Items?.map(async (item) => {
        const key = DynamoDbKeys.ALERT_COMMENT_FILE(
          this.tenantId,
          item.alertId,
          item.commentId,
          item.s3Key
        )

        await this.dynamoDb.send(
          new DeleteCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
            Key: key,
          })
        )

        await this.localChangeHandler(key)
      })
    )
  }

  public async updateStatus(
    alertIds: string[],
    statusChange: CaseStatusChange,
    isLastInReview?: boolean
  ) {
    const now = Date.now()

    const updateExpression = `SET lastStatusChange = :statusChange, updatedAt = :updatedAt, ${
      isLastInReview
        ? 'userId = lastStatusChange.userId, reviewerId = :reviewerId'
        : 'userId = :userId'
    }, statusChanges = list_append(if_not_exists(statusChanges, :empty_list), :statusChange), alertStatus = :alertStatus`

    const expressionAttributeValues = {
      ':statusChange': [statusChange],
      ...(!isLastInReview && { ':userId': statusChange.userId }),
      ...(isLastInReview && { ':reviewerId': statusChange.userId }),
      ':updatedAt': now,
      ':alertStatus': statusChange.caseStatus,
      ':empty_list': [],
    }

    await Promise.all(
      alertIds.map(async (alertId) => {
        const key = DynamoDbKeys.ALERT(this.tenantId, alertId)

        await this.dynamoDb.send(
          new UpdateCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        )

        await this.localChangeHandler(key)
      })
    )
  }
  public async getAlert(alertId: string): Promise<Alert | undefined> {
    const key = DynamoDbKeys.ALERT(this.tenantId, alertId)
    const command = new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      Key: key,
    })

    const commandResult = await this.dynamoDb.send(command)

    return commandResult.Item as Alert | undefined
  }

  public async updateAssignments(
    alertIds: string[],
    assignments: Assignment[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpression = `SET assignments = :assignments, updatedAt = :updatedAt`

    const expressionAttributeValues = {
      ':assignments': assignments,
      ':updatedAt': now,
    }

    await Promise.all(
      alertIds.map(async (alertId) => {
        const key = DynamoDbKeys.ALERT(this.tenantId, alertId)
        await this.dynamoDb.send(
          new UpdateCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        )

        await this.localChangeHandler(key)
      })
    )
  }

  public async updateInReviewAssignments(
    alertIds: string[],
    assignments: Assignment[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpression = `SET assignments = :assignments, reviewAssignments = :reviewAssignments, updatedAt = :updatedAt`

    const expressionAttributeValues = {
      ':assignments': assignments,
      ':reviewAssignments': reviewAssignments,
      ':updatedAt': now,
    }

    await Promise.all(
      alertIds.map(async (alertId) => {
        const key = DynamoDbKeys.ALERT(this.tenantId, alertId)
        await this.dynamoDb.send(
          new UpdateCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        )
      })
    )
  }

  public async updateReviewAssignments(
    alertIds: string[],
    reviewAssignments: Assignment[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpression = `SET reviewAssignments = :reviewAssignments, updatedAt = :updatedAt`

    const expressionAttributeValues = {
      ':reviewAssignments': reviewAssignments,
      ':updatedAt': now,
    }

    await Promise.all(
      alertIds.map(async (alertId) => {
        const key = DynamoDbKeys.ALERT(this.tenantId, alertId)
        await this.dynamoDb.send(
          new UpdateCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        )
      })
    )
  }

  public async updateReviewAssignmentsToAssignments(
    alertIds: string[]
  ): Promise<void> {
    const now = Date.now()

    const updateExpression = `SET assignments = reviewAssignments, updatedAt = :updatedAt`

    const expressionAttributeValues = {
      ':updatedAt': now,
    }

    await Promise.all(
      alertIds.map(async (alertId) => {
        const key = DynamoDbKeys.ALERT(this.tenantId, alertId)

        await this.dynamoDb.send(
          new UpdateCommand({
            TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        )

        await this.localChangeHandler(key)
      })
    )
  }

  private async localChangeHandler(primaryKey: {
    PartitionKeyID: string
    SortKeyID: string
  }) {
    if (runLocalChangeHandler()) {
      const { localTarponChangeCaptureHandler } = await import(
        '@/utils/local-dynamodb-change-handler'
      )
      await localTarponChangeCaptureHandler(this.tenantId, primaryKey)
    }
  }

  public async getAlerts(alertIds: string[]): Promise<Alert[]> {
    const alerts = await batchGet<Alert>(
      this.dynamoDb,
      StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId),
      alertIds.map((alertId) => DynamoDbKeys.ALERT(this.tenantId, alertId))
    )

    return alerts
  }
}
