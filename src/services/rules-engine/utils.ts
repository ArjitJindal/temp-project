import { Transaction } from '@/@types/openapi-public/Transaction'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export function getSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    transaction.senderUserId,
    transaction.senderPaymentDetails,
    'sending',
    transactionType,
    transaction.timestamp
  )
}

export function getReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    transaction.receiverUserId,
    transaction.receiverPaymentDetails,
    'receiving',
    transactionType,
    transaction.timestamp
  )
}
