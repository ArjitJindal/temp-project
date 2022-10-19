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
} from './dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { User } from '@/@types/openapi-public/User'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'

type DynamoDbEntityType =
  | 'TRANSACTION'
  | 'USER'
  | 'TRANSACTION_EVENT'
  | 'CONSUMER_USER_EVENT'
  | 'BUSINESS_USER_EVENT'
  | 'KRS_VALUE'

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
  if (partitionKeyId.includes(TRANSACTION_PRIMARY_KEY_IDENTIFIER)) {
    return {
      type: 'TRANSACTION',
      entityId: `TRANSACTION:${
        (entity as TransactionWithRulesResult).transactionId
      }`,
    }
  } else if (partitionKeyId.includes(USER_PRIMARY_KEY_IDENTIFIER)) {
    return {
      type: 'USER',
      entityId: `USER:${(entity as User).userId}`,
    }
  } else if (partitionKeyId.includes(CONSUMER_USER_EVENT_KEY_IDENTIFIER)) {
    return {
      type: 'CONSUMER_USER_EVENT',
      entityId: `USER:${(entity as ConsumerUserEvent).userId}`,
    }
  } else if (partitionKeyId.includes(BUSINESS_USER_EVENT_KEY_IDENTIFIER)) {
    return {
      type: 'BUSINESS_USER_EVENT',
      entityId: `USER:${(entity as BusinessUserEvent).userId}`,
    }
  } else if (partitionKeyId.includes(TRANSACTION_EVENT_KEY_IDENTIFIER)) {
    return {
      type: 'TRANSACTION_EVENT',
      entityId: `TRANSACTION:${(entity as TransactionEvent).transactionId}`,
    }
  } else if (partitionKeyId.includes(KRS_KEY_IDENTIFIER)) {
    logger.info(`Meta part: ${partitionKeyId}`)
    return {
      type: 'KRS_VALUE',
      entityId: `KRS_VALUE:${entity.userId}`,
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
  logger.info(`PK: ${partitionKeyId}`)
  const metadata = getDynamoDbEntityMetadata(
    partitionKeyId,
    OldImage || NewImage
  )
  logger.info(`metadatas: ${metadata}`)
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

    return {
      ...getDynamoDbEntity(dynamoDBStreamRecord),
      rawRecord: record,
      sequenceNumber: payload.sequenceNumber,
    }
  }).filter(Boolean) as DynamoDbEntityUpdate[]
}
