import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { StackConstants } from '@lib/constants'
import { v4 as uuidv4 } from 'uuid'
import { omit } from 'lodash'
import { GetCommand, GetCommandInput } from '@aws-sdk/lib-dynamodb'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { WebhookConfiguration } from '@/@types/openapi-internal/WebhookConfiguration'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { traceable } from '@/core/xray'
import {
  sanitizeMongoObject,
  batchGet,
  dangerouslyDeletePartitionKey,
  DynamoTransactionBatch,
} from '@/utils/dynamodb'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { envIs } from '@/utils/env'

const handleLocalChangeCapture = async (
  tenantId: string,
  primaryKeys: { PartitionKeyID: string; SortKeyID?: string }[]
) => {
  const { localTarponChangeCaptureHandler } = await import(
    '@/utils/local-dynamodb-change-handler'
  )
  for (const key of primaryKeys) {
    await localTarponChangeCaptureHandler(tenantId, key, 'TARPON')
  }
}

@traceable
export class DynamoWebhookRepository {
  private readonly tenantId: string
  private readonly dynamoDb: DynamoDBClient
  private readonly tableName: string
  private readonly webhooksClickhouseTableName: string

  constructor(tenantId: string, dynamoDb: DynamoDBClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
    this.webhooksClickhouseTableName = CLICKHOUSE_DEFINITIONS.WEBHOOK.tableName
  }

  public async saveWebhook(webhook: WebhookConfiguration) {
    const key = DynamoDbKeys.WEBHOOK_CONFIGURATION(
      this.tenantId,
      webhook._id ?? uuidv4()
    )
    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)
    batch.put({
      Item: {
        ...key,
        ...sanitizeMongoObject(webhook),
      },
    })
    await batch.execute()
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
  }

  public async saveToDynamo(webhooks: WebhookConfiguration[]): Promise<void> {
    if (webhooks.length === 0) {
      return
    }
    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)
    const keys: { PartitionKeyID: string; SortKeyID?: string }[] = []
    for (const webhook of webhooks) {
      const key = DynamoDbKeys.WEBHOOK_CONFIGURATION(
        this.tenantId,
        webhook._id ?? uuidv4()
      )
      keys.push(key)
      batch.put({
        Item: {
          ...key,
          ...sanitizeMongoObject(webhook),
        },
      })
    }
    await batch.execute()
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, keys)
    }
  }

  public async getWebhookFromIds(
    ids: string[]
  ): Promise<WebhookConfiguration[]> {
    const results = await batchGet<WebhookConfiguration>(
      this.dynamoDb,
      this.tableName,
      ids.map((id) => DynamoDbKeys.WEBHOOK_CONFIGURATION(this.tenantId, id))
    )
    const resultMap = results.reduce((acc, item) => {
      const id = item._id as string
      acc[id] = omit(item, [
        'PartitionKeyID',
        'SortKeyID',
      ]) as WebhookConfiguration
      return acc
    }, {} as Record<string, WebhookConfiguration>)
    return ids.map((id) => resultMap[id]).filter(Boolean)
  }

  public async disableWebhook(id: string, message: string) {
    const key = DynamoDbKeys.WEBHOOK_CONFIGURATION(this.tenantId, id)
    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)
    batch.update({
      Key: key,
      UpdateExpression:
        'set enabled = :enabled, autoDisableMessage = :autoDisableMessage',
      ExpressionAttributeValues: {
        ':enabled': false,
        ':autoDisableMessage': message,
      },
    })
    await batch.execute()
    if (envIs('local') || envIs('test')) {
      await handleLocalChangeCapture(this.tenantId, [key])
    }
  }

  public async getWebhook(id: string): Promise<WebhookConfiguration | null> {
    const key = DynamoDbKeys.WEBHOOK_CONFIGURATION(this.tenantId, id)
    const commandInput: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
    }
    const command = new GetCommand(commandInput)
    const commandResult = await this.dynamoDb.send(command)
    if (!commandResult.Item) {
      return null
    }
    const webhook = commandResult.Item as WebhookConfiguration
    return omit(webhook, [
      'PartitionKeyID',
      'SortKeyID',
    ]) as WebhookConfiguration
  }

  public async deleteWebhook(id: string): Promise<void> {
    const key = DynamoDbKeys.WEBHOOK_CONFIGURATION(this.tenantId, id)
    await dangerouslyDeletePartitionKey(this.dynamoDb, key, this.tableName)
    const query = `ALTER TABLE ${this.webhooksClickhouseTableName} UPDATE is_deleted = 1 WHERE id = '${id}'`
    const client = await getClickhouseClient(this.tenantId)
    await client.query({ query })
  }
}
