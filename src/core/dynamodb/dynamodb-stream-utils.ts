import {
  KinesisStreamEvent,
  KinesisStreamRecord,
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
  BUSINESS_USER_EVENT_KEY_IDENTIFIER,
  KRS_KEY_IDENTIFIER,
  ARS_KEY_IDENTIFIER,
  DRS_KEY_IDENTIFIER,
  DEVICE_DATA_METRICS_KEY_IDENTIFIER,
} from './dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { User } from '@/@types/openapi-public/User'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { DeviceMetric } from '@/@types/openapi-public-device-data/DeviceMetric'

type DynamoDbEntityType =
  | 'TRANSACTION'
  | 'USER'
  | 'TRANSACTION_EVENT'
  | 'CONSUMER_USER_EVENT'
  | 'BUSINESS_USER_EVENT'
  | 'KRS_VALUE'
  | 'ARS_VALUE'
  | 'DRS_VALUE'
  | 'DEVICE_DATA_METRICS'

export type DynamoDbEntityUpdate = {
  tenantId: string
  type: DynamoDbEntityType
  entityId: string
  sequenceNumber?: string
  NewImage?: { [key: string]: any }
  OldImage?: { [key: string]: any }
  rawRecord?: KinesisStreamRecord
}

function unMarshallDynamoDBStream(dataString: string) {
  const data = dataString.replace('"B":', '"S":')
  const parserd_json = JSON.parse(data)
  return DynamoDB.Converter.unmarshall(parserd_json)
}

function getDynamoDbEntityMetadata(
  partitionKeyId: string,
  entity: any
): { type: DynamoDbEntityType; entityId: string } | null {
  if (!entity) {
    return null
  }

  if (partitionKeyId.includes(TRANSACTION_PRIMARY_KEY_IDENTIFIER)) {
    const entityId = (entity as TransactionWithRulesResult).transactionId
    if (!entityId) {
      return null
    }
    return {
      type: 'TRANSACTION',
      entityId: `TRANSACTION:${entityId}`,
    }
  } else if (partitionKeyId.includes(USER_PRIMARY_KEY_IDENTIFIER)) {
    const entityId = (entity as User).userId
    if (!entityId) {
      return null
    }
    return {
      type: 'USER',
      entityId: `USER:${entityId}`,
    }
  } else if (partitionKeyId.includes(CONSUMER_USER_EVENT_KEY_IDENTIFIER)) {
    const entityId = (entity as ConsumerUserEvent).userId
    if (!entityId) {
      return null
    }
    return {
      type: 'CONSUMER_USER_EVENT',
      entityId: `USER:${entityId}`,
    }
  } else if (partitionKeyId.includes(DEVICE_DATA_METRICS_KEY_IDENTIFIER)) {
    const entityId = (entity as DeviceMetric).userId
    if (!entityId) {
      return null
    }
    return {
      type: 'DEVICE_DATA_METRICS',
      entityId: `DEVICE_DATA_METRICS:${entityId}`,
    }
  } else if (partitionKeyId.includes(BUSINESS_USER_EVENT_KEY_IDENTIFIER)) {
    const entityId = (entity as BusinessUserEvent).userId
    if (!entityId) {
      return null
    }
    return {
      type: 'BUSINESS_USER_EVENT',
      entityId: `USER:${entityId}`,
    }
  } else if (partitionKeyId.includes(TRANSACTION_EVENT_KEY_IDENTIFIER)) {
    const entityId = (entity as TransactionEvent).transactionId
    if (!entityId) {
      return null
    }
    return {
      type: 'TRANSACTION_EVENT',
      entityId: `TRANSACTION:${entityId}`,
    }
  } else if (partitionKeyId.includes(KRS_KEY_IDENTIFIER)) {
    const entityId = entity.userId
    if (!entityId) {
      return null
    }
    return {
      type: 'KRS_VALUE',
      entityId: `KRS_VALUE:${entityId}`,
    }
  } else if (partitionKeyId.includes(ARS_KEY_IDENTIFIER)) {
    const entityId = entity.userId
    if (!entityId) {
      return null
    }
    return {
      type: 'ARS_VALUE',
      entityId: `ARS_VALUE:${entityId}`,
    }
  } else if (partitionKeyId.includes(DRS_KEY_IDENTIFIER)) {
    const entityId = entity.userId
    if (!entityId) {
      return null
    }
    return {
      type: 'DRS_VALUE',
      entityId: `DRS_VALUE:${entityId}`,
    }
  }
  return null
}

function getDynamoDbEntity(
  dynamoDBStreamRecord: StreamRecord
): DynamoDbEntityUpdate | null {
  const partitionKeyId = dynamoDBStreamRecord.Keys?.PartitionKeyID?.S
  const tenantId = partitionKeyId?.split('#')[0]
  const NewImage =
    dynamoDBStreamRecord.NewImage &&
    unMarshallDynamoDBStream(JSON.stringify(dynamoDBStreamRecord.NewImage))
  const OldImage =
    dynamoDBStreamRecord.OldImage &&
    unMarshallDynamoDBStream(JSON.stringify(dynamoDBStreamRecord.OldImage))
  if (!tenantId) {
    logger.error(
      `Cannot get tenant ID from partition key ID: ${partitionKeyId}`
    )
    return null
  }
  const metadata =
    getDynamoDbEntityMetadata(partitionKeyId, NewImage) ??
    getDynamoDbEntityMetadata(partitionKeyId, OldImage)
  if (!metadata) {
    return null
  }
  return {
    tenantId,
    type: metadata.type,
    entityId: metadata.entityId,
    NewImage,
    OldImage,
  }
}

export function getDynamoDbUpdates(
  event: KinesisStreamEvent
): DynamoDbEntityUpdate[] {
  return event.Records.map((record) => {
    const payload: KinesisStreamRecordPayload = record.kinesis
    const message: string = Buffer.from(payload.data, 'base64').toString()

    const dynamoDBStreamRecord = JSON.parse(message).dynamodb as StreamRecord
    const entity = getDynamoDbEntity(dynamoDBStreamRecord)

    return (
      entity && {
        ...entity,
        rawRecord: record,
        sequenceNumber: payload.sequenceNumber,
      }
    )
  }).filter(Boolean) as DynamoDbEntityUpdate[]
}
