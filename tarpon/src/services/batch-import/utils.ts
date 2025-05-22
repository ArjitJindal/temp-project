import { AsyncBatchRecord } from '../rules-engine/utils'
import { UserType } from '@/@types/openapi-internal/UserType'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export type BatchEntity =
  | 'TRANSACTION_BATCH'
  | 'TRANSACTION_EVENT_BATCH'
  | 'USER_BATCH'
  | 'USER_EVENT_BATCH'

export function getEntityId(entity: AsyncBatchRecord): string | undefined {
  switch (entity.type) {
    case 'TRANSACTION_BATCH':
      return entity.transaction.transactionId
    case 'TRANSACTION_EVENT_BATCH':
      return entity.transactionEvent.eventId
    case 'USER_BATCH':
      return entity.user.userId
    default:
      return entity.userEvent.eventId
  }
}

export type EntityList = {
  entityIds: string[]
}

export const getDynamoKeys = (
  tenantId: string,
  batchId: string,
  type: BatchEntity,
  userType?: UserType
) => {
  switch (type) {
    case 'TRANSACTION_BATCH':
      return DynamoDbKeys.BATCH_TRANSACTION(tenantId, batchId)
    case 'TRANSACTION_EVENT_BATCH':
      return DynamoDbKeys.BATCH_TRANSACTION_EVENT(tenantId, batchId)
    case 'USER_BATCH':
      return userType === 'CONSUMER'
        ? DynamoDbKeys.BATCH_CONSUMER_USER(tenantId, batchId)
        : DynamoDbKeys.BATCH_BUSINESS_USER(tenantId, batchId)
    default:
      return userType === 'CONSUMER'
        ? DynamoDbKeys.BATCH_CONSUMER_USER_EVENT(tenantId, batchId)
        : DynamoDbKeys.BATCH_BUSINESS_USER_EVENT(tenantId, batchId)
  }
}
