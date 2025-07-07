import { NotFound } from 'http-errors'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { StackConstants } from '@lib/constants'
import {
  UpdateCommand,
  UpdateCommandInput,
  QueryCommand,
  QueryCommandInput,
  NativeAttributeValue,
} from '@aws-sdk/lib-dynamodb'
import { traceable } from '@/core/xray'
import { ConsoleActionReason } from '@/@types/openapi-internal/ConsoleActionReason'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  sanitizeMongoObject,
  transactWrite,
  TransactWriteOperation,
} from '@/utils/dynamodb'
import { ReasonType } from '@/@types/openapi-internal/ReasonType'

@traceable
export class DynamoReasonsRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBClient
  private readonly tableName: string

  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async getReason(id: string, reasonType: ReasonType) {
    const { PartitionKeyID, SortKeyID } = DynamoDbKeys.REASONS(
      this.tenantId,
      id,
      reasonType
    )

    const commandInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression:
        'PartitionKeyID = :partitionKey AND SortKeyID = :sortKey',
      FilterExpression: 'isDeleted = :deleted',
      ExpressionAttributeValues: {
        ':partitionKey': PartitionKeyID,
        ':sortKey': SortKeyID,
        ':deleted': false,
      },
    }

    const command = new QueryCommand(commandInput)
    const commandResult = await this.dynamoDb.send(command)

    if (!commandResult.Items || commandResult.Items.length === 0) {
      return null
    }

    return commandResult.Items[0] as ConsoleActionReason
  }

  public async getReasons(type?: ReasonType): Promise<ConsoleActionReason[]> {
    const keyConditionExpression = 'PartitionKeyID = :partitionKey'
    let filterExpression = 'isDeleted <> :deleted'
    const { PartitionKeyID } = DynamoDbKeys.REASONS(this.tenantId, '', type)

    if (type) {
      filterExpression += ' AND reasonType = :type'
    }

    const commandInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: {
        ':partitionKey': PartitionKeyID,
        ':deleted': { BOOL: true },
        ...(type && { ':type': type }),
      },
    }

    const command = new QueryCommand(commandInput)
    const result = await this.dynamoDb.send(command)

    if (!result.Items) {
      return []
    }
    const items = (result.Items ?? []) as ConsoleActionReason[]

    items.sort((a, b) => a.id.localeCompare(b.id))

    return items
  }

  public async saveReasons(reasons: ConsoleActionReason[]) {
    const writeRequests: TransactWriteOperation[] = []
    for (const reason of reasons) {
      if (!reason.id) {
        continue
      }
      const key = DynamoDbKeys.REASONS(
        this.tenantId,
        reason.id,
        reason.reasonType
      )
      const data = sanitizeMongoObject(reason)
      writeRequests.push({
        Put: {
          TableName: this.tableName,
          Item: {
            ...key,
            ...data,
            isDeleted: false,
          },
        },
      })
    }
    await transactWrite(this.dynamoDb, writeRequests)
  }

  public async updateReason(
    id: string,
    reasonType: ReasonType,
    actionReason: Partial<ConsoleActionReason>,
    updatedAt?: number
  ) {
    const existingRecord = await this.getReason(id, reasonType)
    if (!existingRecord) {
      throw new NotFound('Reason not found')
    }

    const updateEntries = Object.entries(actionReason)
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, NativeAttributeValue> = {
      ':updatedAt': updatedAt,
    }

    const setExpressions = updateEntries.map(([key, value], index) => {
      const attrName = `#field${index}`
      const attrValue = `:value${index}`
      expressionAttributeNames[attrName] = key
      expressionAttributeValues[attrValue] = value
      return `${attrName} = ${attrValue}`
    })

    const UpdateExpression = `SET ${[
      ...setExpressions,
      '#updatedAt = :updatedAt',
    ].join(', ')}`

    const commandInput: UpdateCommandInput = {
      TableName: this.tableName,
      Key: DynamoDbKeys.REASONS(this.tenantId, id, reasonType),
      UpdateExpression,
      ExpressionAttributeNames: {
        ...expressionAttributeNames,
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: expressionAttributeValues,
    }

    const command = new UpdateCommand(commandInput)
    await this.dynamoDb.send(command)

    return { ...existingRecord, ...actionReason, updatedAt }
  }

  public async deleteReason(id: string, reasonType: ReasonType) {
    const existingRecord = await this.getReason(id, reasonType)
    if (!existingRecord) {
      throw new NotFound('Reason not found')
    }
    const key = DynamoDbKeys.REASONS(this.tenantId, id, reasonType)
    const commandInput: UpdateCommandInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'SET isDeleted = :isDeleted',
      ExpressionAttributeValues: {
        ':isDeleted': true,
      },
    }
    await this.dynamoDb.send(new UpdateCommand(commandInput))
  }
}
