import {
  KinesisStreamEvent,
  KinesisStreamRecordPayload,
  StreamRecord,
} from 'aws-lambda'
import { unmarshall } from '@aws-sdk/util-dynamodb'
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
  RULE_INSTANCE_IDENTIFIER,
  AVG_ARS_KEY_IDENTIFIER,
  ALERT_KEY_IDENTIFIER,
  ALERT_COMMENT_KEY_IDENTIFIER,
  ALERT_FILE_ID_IDENTIFIER,
  CRM_RECORD_KEY_IDENTIFIER,
  CRM_USER_RECORD_LINK_KEY_IDENTIFIER,
  ALERTS_QA_SAMPLING_KEY_IDENTIFIER,
  API_REQUEST_LOGS_KEY_IDENTIFIER,
  NOTIFICATIONS_KEY_IDENTIFIER,
} from './dynamodb-keys'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { User } from '@/@types/openapi-public/User'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { RuleInstance } from '@/@types/openapi-public-management/RuleInstance'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { DYNAMODB_PARTITIONKEYS_COLLECTION } from '@/utils/mongodb-definitions'
import { Business } from '@/@types/openapi-internal/Business'

export type DynamoDbEntityType =
  | 'TRANSACTION'
  | 'USER'
  | 'TRANSACTION_EVENT'
  | 'CONSUMER_USER_EVENT'
  | 'BUSINESS_USER_EVENT'
  | 'RULE_INSTANCE'
  | 'KRS_VALUE'
  | 'ARS_VALUE'
  | 'DRS_VALUE'
  | 'AVG_ARS_VALUE'
  | 'ALERT'
  | 'ALERT_COMMENT'
  | 'ALERT_FILE'
  | 'CRM_RECORD'
  | 'CRM_USER_RECORD_LINK'
  | 'ALERTS_QA_SAMPLING'
  | 'API_REQUEST_LOGS'
  | 'NOTIFICATION'
export type DynamoDbEntityUpdate = {
  tenantId: string
  type?: DynamoDbEntityType
  entityId?: string
  sequenceNumber?: string
  NewImage?: { [key: string]: any }
  OldImage?: { [key: string]: any }
  partitionKeyId: string
  sortKeyId?: string
}

function unMarshallDynamoDBStream(dataString: string) {
  const data = dataString.replace('"B":', '"S":')
  const parserd_json = JSON.parse(data)
  return unmarshall(parserd_json)
}

export function getDynamoDbEntityMetadata(
  partitionKeyId: string,
  sortKeyId: string,
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
      entityId: `USER:${entityId}`,
    }
  } else if (partitionKeyId.includes(ARS_KEY_IDENTIFIER)) {
    const entityId = entity.transactionId
    if (!entityId) {
      return null
    }
    return {
      type: 'ARS_VALUE',
      entityId: `TRANSACTION:${entityId}`,
    }
  } else if (partitionKeyId.includes(AVG_ARS_KEY_IDENTIFIER)) {
    const entityId = entity.userId
    if (!entityId) {
      return null
    }
    return {
      type: 'AVG_ARS_VALUE',
      entityId: `USER:${entityId}`,
    }
  } else if (partitionKeyId.includes(DRS_KEY_IDENTIFIER)) {
    const entityId = entity.userId
    if (!entityId) {
      return null
    }
    return {
      type: 'DRS_VALUE',
      entityId: `USER:${entityId}`,
    }
  } else if (partitionKeyId.includes(RULE_INSTANCE_IDENTIFIER)) {
    const entityId = (entity as RuleInstance).id
    if (!entityId) {
      return null
    }
    return {
      type: 'RULE_INSTANCE',
      entityId: `RULE_INSTANCE:${entityId}`,
    }
  } else if (partitionKeyId.includes(ALERT_KEY_IDENTIFIER)) {
    const entityId = entity.alertId

    if (!entityId) {
      return null
    }

    return {
      type: 'ALERT',
      entityId: `ALERT:${entityId}`,
    }
  } else if (partitionKeyId.includes(ALERT_COMMENT_KEY_IDENTIFIER)) {
    const entityId = entity.commentId

    if (!entityId) {
      return null
    }

    return {
      type: 'ALERT_COMMENT',
      entityId: `ALERT:${entityId}`,
    }
  } else if (partitionKeyId.includes(ALERT_FILE_ID_IDENTIFIER)) {
    const entityId = entity.fileId

    if (!entityId) {
      return null
    }

    return {
      type: 'ALERT_FILE',
      entityId: `ALERT:${entityId}`,
    }
  } else if (partitionKeyId.includes(CRM_RECORD_KEY_IDENTIFIER)) {
    const entityId = entity.id
    if (!entityId) {
      return null
    }
    return {
      type: 'CRM_RECORD',
      entityId: `CRM_RECORD:${entityId}`,
    }
  } else if (partitionKeyId.includes(CRM_USER_RECORD_LINK_KEY_IDENTIFIER)) {
    const entityId = entity.id
    if (!entityId) {
      return null
    }
    return {
      type: 'CRM_USER_RECORD_LINK',
      entityId: `CRM_USER_RECORD_LINK:${entityId}`,
    }
  } else if (partitionKeyId.includes(ALERTS_QA_SAMPLING_KEY_IDENTIFIER)) {
    const entityId = entity.samplingId
    if (!entityId) {
      return null
    }
    return {
      type: 'ALERTS_QA_SAMPLING',
      entityId: `ALERTS_QA_SAMPLING:${entityId}`,
    }
  } else if (partitionKeyId.includes(NOTIFICATIONS_KEY_IDENTIFIER)) {
    const entityId = entity.id
    if (!entityId) {
      return null
    }
    return {
      type: 'NOTIFICATION',
      entityId: `NOTIFICATION:${entityId}`,
    }
  } else if (partitionKeyId.includes(API_REQUEST_LOGS_KEY_IDENTIFIER)) {
    const entityId = entity.requestId
    if (!entityId) {
      return null
    }
    return {
      type: 'API_REQUEST_LOGS',
      entityId: `API_REQUEST_LOGS:${entityId}`,
    }
  }

  return null
}

function getDynamoDbEntity(
  dynamoDBStreamRecord: StreamRecord
): DynamoDbEntityUpdate | null {
  const partitionKeyId = dynamoDBStreamRecord.Keys?.PartitionKeyID?.S as string
  const sortKeyId = dynamoDBStreamRecord.Keys?.SortKeyID?.S as string
  const tenantId = partitionKeyId?.split('#')[0] as string
  let NewImage =
    dynamoDBStreamRecord.NewImage &&
    unMarshallDynamoDBStream(JSON.stringify(dynamoDBStreamRecord.NewImage))
  let OldImage =
    dynamoDBStreamRecord.OldImage &&
    unMarshallDynamoDBStream(JSON.stringify(dynamoDBStreamRecord.OldImage))
  if (!tenantId) {
    logger.error(
      `Cannot get tenant ID from partition key ID: ${partitionKeyId}`
    )
    return null
  }
  const metadata =
    getDynamoDbEntityMetadata(partitionKeyId, sortKeyId, NewImage) ??
    getDynamoDbEntityMetadata(partitionKeyId, sortKeyId, OldImage)

  // Quick fix for b4bpayments
  if (metadata?.type === 'USER' && tenantId.toLowerCase() === '0789ad73b8') {
    // b4b only attach `parentUserId` to the user entity. We could rebuild linkedEntities using
    // parentUserId later.
    if (OldImage) {
      const oldUser = OldImage as User | Business
      if ((oldUser.linkedEntities as any)?.childUserIds) {
        ;(oldUser.linkedEntities as any).childUserIds = []
      }
      OldImage = oldUser
    }
    if (NewImage) {
      const newUser = NewImage as User | Business
      if ((newUser.linkedEntities as any)?.childUserIds) {
        ;(newUser.linkedEntities as any).childUserIds = []
      }
      NewImage = newUser
    }
  }

  if (
    metadata?.type === 'BUSINESS_USER_EVENT' &&
    tenantId.toLowerCase() === '0789ad73b8'
  ) {
    // b4b only attach `parentUserId` to the user entity. We could rebuild linkedEntities using
    // parentUserId later.
    if (OldImage) {
      const oldUser = OldImage as BusinessUserEvent
      if (oldUser.updatedBusinessUserAttributes?.linkedEntities) {
        ;(
          oldUser.updatedBusinessUserAttributes.linkedEntities as any
        ).childUserIds = []
      }
      OldImage = oldUser
    }
    if (NewImage) {
      const newUser = NewImage as BusinessUserEvent
      if (newUser.updatedBusinessUserAttributes?.linkedEntities) {
        ;(
          newUser.updatedBusinessUserAttributes.linkedEntities as any
        ).childUserIds = []
      }
      NewImage = newUser
    }
  }

  return {
    tenantId,
    type: metadata?.type,
    entityId: metadata?.entityId,
    NewImage,
    OldImage,
    partitionKeyId,
    sortKeyId,
  }
}

export async function savePartitionKey(
  tenantId: string,
  partitionKey: string,
  tableName: string
) {
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const collection = db.collection(DYNAMODB_PARTITIONKEYS_COLLECTION(tenantId))
  await collection.replaceOne(
    { _id: partitionKey as any },
    { _id: partitionKey, table: tableName },
    { upsert: true }
  )
}

export function getDynamoDbUpdates(
  event: KinesisStreamEvent
): DynamoDbEntityUpdate[] {
  return event.Records.map((record) => {
    const payload: KinesisStreamRecordPayload = record.kinesis
    const message: string = Buffer.from(payload.data, 'base64').toString()
    const dynamoDBStreamRecord = JSON.parse(message).dynamodb as StreamRecord
    // If the record is a delete, we don't need to process it
    if (!dynamoDBStreamRecord.NewImage) {
      return null
    }

    const entity = getDynamoDbEntity(dynamoDBStreamRecord)

    return (
      entity && {
        ...entity,
        sequenceNumber: payload.sequenceNumber,
      }
    )
  }).filter(Boolean) as DynamoDbEntityUpdate[]
}
