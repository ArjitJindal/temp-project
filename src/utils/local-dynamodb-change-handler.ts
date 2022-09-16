import {
  KinesisStreamEvent,
  KinesisStreamRecordPayload,
  KinesisStreamRecord,
} from 'aws-lambda'
import { StackConstants } from '@cdk/constants'
import { DynamoDB } from 'aws-sdk'
import { getDynamoDbClientByEvent } from './dynamodb'

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
  if (process.env.ENV !== 'local') {
    return
  }

  const dynamoDb = getDynamoDbClientByEvent(null as any)
  const entity = await dynamoDb
    .get({
      TableName: StackConstants.TARPON_DYNAMODB_TABLE_NAME,
      Key: key,
    })
    .promise()
  const kinesisEvent = createKinesisStreamEvent(
    key.PartitionKeyID,
    key.SortKeyID,
    undefined,
    entity.Item
  )
  const { tarponChangeCaptureHandler } = await import(
    '@/lambdas/tarpon-change-capture-kinesis-consumer/app'
  )
  await (
    tarponChangeCaptureHandler as any as (
      event: KinesisStreamEvent
    ) => Promise<void>
  )(kinesisEvent)
}
