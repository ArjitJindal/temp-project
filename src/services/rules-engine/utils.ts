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
  | undefined
  | null {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    transaction.originUserId,
    transaction.originPaymentDetails,
    'sending',
    transactionType,
    transaction.timestamp
  )
}

export function getUserSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.originUserId
    ? DynamoDbKeys.USER_TRANSACTION(
        tenantId,
        transaction.originUserId,
        'sending',
        transactionType,
        transaction.timestamp
      )
    : null
}

export function getNonUserSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.originPaymentDetails
    ? DynamoDbKeys.NON_USER_TRANSACTION(
        tenantId,
        transaction.originPaymentDetails,
        'sending',
        transactionType,
        transaction.timestamp
      )
    : null
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
  | undefined
  | null {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    transaction.destinationUserId,
    transaction.destinationPaymentDetails,
    'receiving',
    transactionType,
    transaction.timestamp
  )
}

export function getUserReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.destinationUserId
    ? DynamoDbKeys.USER_TRANSACTION(
        tenantId,
        transaction.destinationUserId,
        'receiving',
        transactionType,
        transaction.timestamp
      )
    : null
}

export function getNonUserReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.destinationPaymentDetails
    ? DynamoDbKeys.NON_USER_TRANSACTION(
        tenantId,
        transaction.destinationPaymentDetails,
        'receiving',
        transactionType,
        transaction.timestamp
      )
    : null
}

export const TIME_WINDOW_SCHEMA = {
  type: 'object',
  title: 'Time Window',
  properties: {
    units: { type: 'integer', title: 'Number of time unit' },
    granularity: {
      type: 'string',
      title: 'Time granularity',
      enum: ['second', 'minute', 'hour', 'day', 'week', 'month'],
    },
    rollingBasis: {
      type: 'boolean',
      title: 'Rolling basis',
      description:
        'When rolling basis is disabled, system starts the time period at 00:00 for day, week, month time granularities',
      nullable: true,
    },
  },
  required: ['units', 'granularity'],
} as const
