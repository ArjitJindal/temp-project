import { StackConstants } from '@lib/constants'
import {
  GetCommand,
  GetCommandInput,
  PutCommand,
  PutCommandInput,
  UpdateCommand,
  UpdateCommandInput,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb'
import { COUNTER_ENTITIES, CounterEntity } from './repository'
import { traceable } from '@/core/xray'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import {
  BatchWriteRequestInternal,
  DynamoTransactionBatch,
} from '@/utils/dynamodb'

@traceable
export class DynamoCounterRepository {
  private tenantId: string
  private dynamoDb: DynamoDBDocumentClient
  private tableName: string

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.tenantId = tenantId
    this.dynamoDb = dynamoDb
    this.tableName = StackConstants.TARPON_DYNAMODB_TABLE_NAME(this.tenantId)
  }

  public async initialize(): Promise<void> {
    for (const entity of COUNTER_ENTITIES) {
      const key = DynamoDbKeys.COUNTER(this.tenantId, entity)
      const commandInput: GetCommandInput = {
        TableName: this.tableName,
        Key: key,
        ConsistentRead: true,
      }
      const command = new GetCommand(commandInput)
      const commandResult = await this.dynamoDb.send(command)
      if (!commandResult.Item) {
        const writeRequest = {
          TableName: this.tableName,
          Item: {
            ...key,
            count: 0,
          },
        }
        await this.dynamoDb.send(new PutCommand(writeRequest))
      }
    }
  }
  public async getNextCounterAndUpdate(
    entity: CounterEntity,
    count: number
  ): Promise<number> {
    const key = DynamoDbKeys.COUNTER(this.tenantId, entity)
    const commandInput: UpdateCommandInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'ADD #count :increment',
      ExpressionAttributeNames: {
        '#count': 'count',
      },
      ExpressionAttributeValues: {
        ':increment': count,
      },
      ReturnValues: 'UPDATED_NEW',
    }
    const command = new UpdateCommand(commandInput)
    const commandResult = await this.dynamoDb.send(command)
    return commandResult.Attributes?.count ?? 1
  }

  public async getNextCounter(entity: CounterEntity): Promise<number> {
    const key = DynamoDbKeys.COUNTER(this.tenantId, entity)
    const commandInput: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
      ConsistentRead: true,
    }
    const command = new GetCommand(commandInput)
    const commandResult = await this.dynamoDb.send(command)
    return (commandResult.Item?.count ?? 0) + 1
  }
  public async getNextCountersAndUpdate(
    entity: CounterEntity,
    count: number
  ): Promise<number[]> {
    const value = (await this.getNextCounterAndUpdate(entity, count)) ?? 1
    return [...new Array(count)].map((_, i) => value - i)
  }

  private counterKeys(entity: CounterEntity) {
    return DynamoDbKeys.COUNTER(this.tenantId, entity)
  }

  public async saveDemoCounterValue(counters: [CounterEntity, number][]) {
    const writeRequests: BatchWriteRequestInternal[] = []
    for (const counter of counters) {
      const key = this.counterKeys(counter[0])
      writeRequests.push({
        PutRequest: { Item: { ...key, count: counter[1] } },
      })
    }
    return { writeRequests, tableName: this.tableName }
  }

  public async setCounterValue(
    entity: CounterEntity,
    count: number
  ): Promise<void> {
    const key = this.counterKeys(entity)
    const commandInput: PutCommandInput = {
      TableName: this.tableName,
      Item: {
        ...key,
        count,
      },
    }
    const command = new PutCommand(commandInput)
    await this.dynamoDb.send(command)
  }

  public async setCounters(
    counters: { entity: CounterEntity; count: number }[]
  ) {
    // Create document client and batch for operations
    const batch = new DynamoTransactionBatch(this.dynamoDb, this.tableName)

    for (const counter of counters) {
      const key = DynamoDbKeys.COUNTER(this.tenantId, counter.entity)

      batch.put({
        Item: {
          ...key,
          count: counter.count,
        },
      })
    }

    await batch.execute()
  }
}
