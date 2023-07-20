import {
  KinesisStreamEvent,
  KinesisStreamRecordPayload,
  KinesisStreamRecord,
} from 'aws-lambda'
import { StackConstants } from '@lib/constants'
import { DynamoDB } from 'aws-sdk'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { getDynamoDbClientByEvent } from './dynamodb'
import { envIs } from './env'

let localChangeHandlerEnabled = false
let localChangeHandlerDisabled = false
export function disableLocalChangeHandler() {
  localChangeHandlerDisabled = true
  localChangeHandlerEnabled = false
}
export function enableLocalChangeHandler() {
  localChangeHandlerEnabled = true
  localChangeHandlerDisabled = false
}

export function runLocalChangeHandler(): boolean {
  if (localChangeHandlerEnabled) {
    return true
  }
  if (localChangeHandlerDisabled) {
    return false
  }
  return envIs('local') || !!process.env.__INTERNAL_MONGODB_MIRROR__
}

export function createKinesisStreamEvent<T>(
  partitionKeyId: string,
  sortKeyId: string | undefined,
  oldItem: T | undefined,
  newItem: T | undefined
): KinesisStreamEvent {
  const dynamodbStreamRecord = {
    Keys: {
      PartitionKeyID: { S: partitionKeyId },
      SortKeyID: { S: sortKeyId },
    },
    OldImage: oldItem && DynamoDB.Converter.marshall(oldItem),
    NewImage: newItem && DynamoDB.Converter.marshall(newItem),
  }
  const kinesisData = Buffer.from(
    JSON.stringify({ dynamodb: dynamodbStreamRecord }),
    'utf8'
  ).toString('base64')
  return {
    Records: [
      {
        kinesis: {
          data: kinesisData,
        } as KinesisStreamRecordPayload,
      } as KinesisStreamRecord,
    ],
  }
}

export async function localTarponChangeCaptureHandler(key: {
  PartitionKeyID: string
  SortKeyID?: string
}) {
  const dynamoDb = getDynamoDbClientByEvent(null as any)
  const entity = await dynamoDb.send(
    new GetCommand({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: key,
    })
  )
  const kinesisEvent = createKinesisStreamEvent(
    key.PartitionKeyID,
    key.SortKeyID,
    undefined,
    entity.Item
  )
  const { tarponChangeMongoDbHandler } = await import(
    '@/lambdas/tarpon-change-mongodb-consumer/app'
  )
  await (
    tarponChangeMongoDbHandler as any as (
      event: KinesisStreamEvent
    ) => Promise<void>
  )(kinesisEvent)
}

export async function localHammerheadChangeCaptureHandler(key: {
  PartitionKeyID: string
  SortKeyID?: string
}) {
  const dynamoDb = getDynamoDbClientByEvent(null as any)
  const entity = await dynamoDb.send(
    new GetCommand({
      TableName: StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME,
      Key: key,
    })
  )
  const kinesisEvent = createKinesisStreamEvent(
    key.PartitionKeyID,
    key.SortKeyID,
    undefined,
    entity.Item
  )
  const { hammerheadChangeMongoDbHandler } = await import(
    '@/lambdas/hammerhead-change-mongodb-consumer/app'
  )
  await (
    hammerheadChangeMongoDbHandler as any as (
      event: KinesisStreamEvent
    ) => Promise<void>
  )(kinesisEvent)
}
