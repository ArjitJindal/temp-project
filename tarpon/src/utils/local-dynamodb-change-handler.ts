import {
  KinesisStreamEvent,
  KinesisStreamRecordPayload,
  KinesisStreamRecord,
} from 'aws-lambda'
import { StackConstants } from '@lib/constants'
import { marshall } from '@aws-sdk/util-dynamodb'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { getDynamoDbClientByEvent } from './dynamodb'
import { envIs } from './env'

let localChangeHandlerEnabled = false
let localChangeHandlerDisabled = false
export function disableLocalChangeHandler() {
  localChangeHandlerEnabled = false
  localChangeHandlerDisabled = true
}
export function enableLocalChangeHandler() {
  localChangeHandlerEnabled = true
  localChangeHandlerDisabled = false
}

export function withLocalChangeHandler() {
  beforeAll(() => {
    enableLocalChangeHandler()
  })

  afterAll(() => {
    disableLocalChangeHandler()
  })
}

export function runLocalChangeHandler(): boolean {
  if (localChangeHandlerDisabled) {
    return false
  }
  return (
    envIs('local') ||
    Boolean(process.env.__INTERNAL_MONGODB_MIRROR__) ||
    localChangeHandlerEnabled
  )
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
    OldImage: oldItem && marshall(oldItem),
    NewImage: newItem && marshall(newItem),
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

export function createKinesisStreamEventBatch<T>(
  keys: { PartitionKeyID: string; SortKeyID?: string }[],
  oldItems: T[] | undefined,
  newItems: T[] | undefined
): KinesisStreamEvent {
  const kinesisRecords = keys.map((key, index) => {
    // console.log(`########## Key ${JSON.stringify(key)}, ${index} ##########`)
    // console.log(`########## New Item ${JSON.stringify(marshall(newItems?.[index]))}, ${index} ##########`)
    const dynamodbStreamRecord = {
      Keys: {
        PartitionKeyID: { S: key.PartitionKeyID },
        SortKeyID: { S: key.SortKeyID },
      },
      OldImage: oldItems && marshall(oldItems[index]),
      NewImage: newItems && marshall(newItems[index]),
    }
    const kinesisData = Buffer.from(
      JSON.stringify({ dynamodb: dynamodbStreamRecord }),
      'utf8'
    ).toString('base64')
    return {
      kinesis: {
        data: kinesisData,
      } as KinesisStreamRecordPayload,
    } as KinesisStreamRecord
  })
  console.log(`########## Kinesis Records ${kinesisRecords.length} ##########`)
  return {
    Records: kinesisRecords,
  }
}

export async function localTarponChangeCaptureHandler(
  tenantId: string,
  key: { PartitionKeyID: string; SortKeyID?: string },
  table: 'TARPON' | 'HAMMERHEAD' = 'TARPON'
) {
  const dynamoDb = getDynamoDbClientByEvent(null as any)

  const entity = await dynamoDb.send(
    new GetCommand({
      TableName:
        table === 'TARPON'
          ? StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
          : StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId),
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

export async function localTarponChangeCaptureHandlerBatch(
  tenantId: string,
  keys: { PartitionKeyID: string; SortKeyID?: string }[],
  table: 'TARPON' | 'HAMMERHEAD' = 'TARPON'
) {
  const dynamoDb = getDynamoDbClientByEvent(null as any)
  const tableName =
    table === 'TARPON'
      ? StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId)
      : StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)

  const entities = await Promise.all(
    keys.map((key) =>
      dynamoDb.send(
        new GetCommand({
          TableName: tableName,
          Key: key,
        })
      )
    )
  )
  console.log(
    `########## Entities ${JSON.stringify(entities)}, ${
      entities.length
    } ##########`
  )
  const kinesisEvent = createKinesisStreamEventBatch(
    keys,
    undefined,
    entities.map((entity) => entity.Item)
  )
  console.log(
    `########## Kinesis Event ${JSON.stringify(kinesisEvent)}, ${
      kinesisEvent.Records.length
    } ##########`
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
