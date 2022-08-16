import {
  KinesisStreamEvent,
  KinesisStreamRecordPayload,
  StreamRecord,
} from 'aws-lambda'
import { DynamoDB } from 'aws-sdk'
import { logger } from '../logger'
import {
  TRANSACTION_EVENT_KEY_IDENTIFIER,
  TRANSACTION_PRIMARY_KEY_IDENTIFIER,
  CONSUMER_USER_EVENT_KEY_IDENTIFIER,
  USER_PRIMARY_KEY_IDENTIFIER,
} from './dynamodb-keys'

type DynamoDbEntityType =
  | 'TRANSACTION'
  | 'USER'
  | 'TRANSACTION_EVENT'
  | 'CONSUMER_USER_EVENT'

type DynamoDbEntityUpdate = {
  tenantId: string
  type: DynamoDbEntityType
  NewImage?: { [key: string]: any }
  OldImage?: { [key: string]: any }
}

function unMarshallDynamoDBStream(dataString: string) {
  const data = dataString.replace('"B":', '"S":')
  const parserd_json = JSON.parse(data)
  return DynamoDB.Converter.unmarshall(parserd_json)
}

function getDynamoDbEntityType(
  partitionKeyId: string
): DynamoDbEntityType | null {
  if (partitionKeyId.includes(TRANSACTION_PRIMARY_KEY_IDENTIFIER)) {
    return 'TRANSACTION'
  } else if (partitionKeyId.includes(USER_PRIMARY_KEY_IDENTIFIER)) {
    return 'USER'
  } else if (partitionKeyId.includes(CONSUMER_USER_EVENT_KEY_IDENTIFIER)) {
    return 'CONSUMER_USER_EVENT'
  } else if (partitionKeyId.includes(TRANSACTION_EVENT_KEY_IDENTIFIER)) {
    return 'TRANSACTION_EVENT'
  } else {
    return null
  }
}

function getDynamoDbEntity(
  dynamoDBStreamRecord: StreamRecord
): DynamoDbEntityUpdate | null {
  const partitionKeyId = dynamoDBStreamRecord.Keys?.PartitionKeyID?.S
  const tenantId = partitionKeyId?.split('#')[0]
  if (!tenantId) {
    logger.error(
      `Cannot get tenant ID from partition key ID: ${partitionKeyId}`
    )
    return null
  }
  const type = getDynamoDbEntityType(partitionKeyId)
  if (!type) {
    return null
  }
  return {
    tenantId,
    type,
    NewImage:
      dynamoDBStreamRecord.NewImage &&
      unMarshallDynamoDBStream(JSON.stringify(dynamoDBStreamRecord.NewImage)),
    OldImage:
      dynamoDBStreamRecord.OldImage &&
      unMarshallDynamoDBStream(JSON.stringify(dynamoDBStreamRecord.OldImage)),
  }
}

export function getDynamoDbUpdates(
  event: KinesisStreamEvent
): DynamoDbEntityUpdate[] {
  return event.Records.map((record) => {
    const payload: KinesisStreamRecordPayload = record.kinesis
    const message: string = Buffer.from(payload.data, 'base64').toString()

    const dynamoDBStreamRecord = JSON.parse(message).dynamodb as StreamRecord

    return getDynamoDbEntity(dynamoDBStreamRecord)
  }).filter(Boolean) as DynamoDbEntityUpdate[]
}
