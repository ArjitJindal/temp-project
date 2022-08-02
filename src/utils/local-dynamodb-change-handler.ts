import {
  KinesisStreamEvent,
  KinesisStreamRecordPayload,
  KinesisStreamRecord,
} from 'aws-lambda'
import { TarponStackConstants } from '@cdk/constants'
import { DynamoDB } from 'aws-sdk'
import { getDynamoDbClient } from './dynamodb'
import { tarponChangeCaptureHandler } from '@/lambdas/tarpon-change-capture-kinesis-consumer/app'

export async function localTarponChangeCaptureHandler(key: {
  PartitionKeyID: string
  SortKeyID?: string
}) {
  if (process.env.ENV !== 'local') {
    return
  }

  const dynamoDb = getDynamoDbClient(null as any)
  const entity = await dynamoDb
    .get({
      TableName: TarponStackConstants.DYNAMODB_TABLE_NAME,
      Key: key,
    })
    .promise()
  const dynamodbStreamRecord = {
    Keys: {
      PartitionKeyID: { S: key.PartitionKeyID },
      SortKeyID: { S: key.SortKeyID },
    },
    NewImage: DynamoDB.Converter.marshall(entity.Item as any),
  }
  const kinesisData = Buffer.from(
    JSON.stringify({ dynamodb: dynamodbStreamRecord }),
    'utf8'
  ).toString('base64')
  const kinesisEvent: KinesisStreamEvent = {
    Records: [
      {
        kinesis: {
          data: kinesisData,
        } as KinesisStreamRecordPayload,
      } as KinesisStreamRecord,
    ],
  }
  await (
    tarponChangeCaptureHandler as any as (
      event: KinesisStreamEvent
    ) => Promise<void>
  )(kinesisEvent)
}
