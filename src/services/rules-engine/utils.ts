import { Transaction } from '@/@types/openapi-public/Transaction'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

export function getSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
):
  | {
      PartitionKeyID: string
      SortKeyID: string
    }
  | undefined {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    transaction.originUserId,
    transaction.originPaymentDetails,
    'sending',
    transactionType,
    transaction.timestamp
  )
}

export function getReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
):
  | {
      PartitionKeyID: string
      SortKeyID: string
    }
  | undefined {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    transaction.destinationUserId,
    transaction.destinationPaymentDetails,
    'receiving',
    transactionType,
    transaction.timestamp
  )
}
