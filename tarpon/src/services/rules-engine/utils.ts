import { Transaction } from '@/@types/openapi-public/Transaction'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'

export function getSenderKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
):
  | {
      PartitionKeyID: string
      SortKeyID: string
    }
  | undefined
  | null {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    options?.matchPaymentDetails ? undefined : transaction.originUserId,
    transaction.originPaymentDetails,
    options?.disableDirection ? 'all' : 'sending',
    transactionType,
    transaction.timestamp
  )
}

export function getSenderKeyId(
  tenantId: string,
  transaction: Transaction,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
): string | undefined {
  return getSenderKeys(tenantId, transaction, undefined, options)
    ?.PartitionKeyID
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
  transactionType?: string,
  disableDirection?: boolean
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.originPaymentDetails
    ? DynamoDbKeys.NON_USER_TRANSACTION(
        tenantId,
        transaction.originPaymentDetails,
        disableDirection ? 'all' : 'sending',
        transactionType,
        transaction.timestamp
      )
    : null
}

export function getReceiverKeys(
  tenantId: string,
  transaction: Transaction,
  transactionType?: string,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
):
  | {
      PartitionKeyID: string
      SortKeyID: string
    }
  | undefined
  | null {
  return DynamoDbKeys.ALL_TRANSACTION(
    tenantId,
    options?.matchPaymentDetails ? undefined : transaction.destinationUserId,
    transaction.destinationPaymentDetails,
    options?.disableDirection ? 'all' : 'receiving',
    transactionType,
    transaction.timestamp
  )
}

export function getReceiverKeyId(
  tenantId: string,
  transaction: Transaction,
  options?: {
    disableDirection?: boolean
    matchPaymentDetails?: boolean
  }
): string | undefined {
  return getReceiverKeys(tenantId, transaction, undefined, options)
    ?.PartitionKeyID
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
  transactionType?: string,
  disableDirection?: boolean
): {
  PartitionKeyID: string
  SortKeyID: string
} | null {
  return transaction.destinationPaymentDetails
    ? DynamoDbKeys.NON_USER_TRANSACTION(
        tenantId,
        transaction.destinationPaymentDetails,
        disableDirection ? 'all' : 'receiving',
        transactionType,
        transaction.timestamp
      )
    : null
}

export function getAggregatedRuleStatus(
  ruleActions: ReadonlyArray<RuleAction>
): RuleAction {
  return ruleActions.reduce((prev, curr) => {
    if (RULE_ACTIONS.indexOf(curr) < RULE_ACTIONS.indexOf(prev)) {
      return curr
    } else {
      return prev
    }
  }, 'ALLOW')
}
