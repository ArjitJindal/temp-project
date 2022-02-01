/**
 * DynamoDB Keys (partition key + sort key) Definitions:
 * We consolidate the DynamoDB keys in this file to be more maintainbable and reviewable.
 * The index key design will be a critical part of our system as it'll severely impact
 * the query performance and our AWS cost.
 */

import { BankDetails } from '../../@types/openapi/bankDetails'
import { CardDetails } from '../../@types/openapi/cardDetails'

const USER_ID_PREFIX = 'user:'

export const DynamoDbKeys = {
  // Attributes: refer to Transaction
  TRANSACTION: (tenantId: string, transactionId: string) => ({
    PartitionKeyID: `${tenantId}#transaction#${transactionId}`,
    SortKeyID: transactionId,
  }),
  ALL_TRANSACTION: (
    tenantId: string,
    userId: string | undefined,
    paymentDetails: CardDetails | BankDetails,
    direction: 'sending' | 'receiving',
    timestamp?: number
  ) => {
    return userId === undefined
      ? DynamoDbKeys.NON_USER_TRANSACTION(
          tenantId,
          paymentDetails,
          direction,
          timestamp
        )
      : DynamoDbKeys.USER_TRANSACTION(tenantId, userId, direction, timestamp)
  },
  // Attributes: [transactionId]
  NON_USER_TRANSACTION: (
    tenantId: string,
    paymentDetails: CardDetails | BankDetails,
    direction: 'sending' | 'receiving',
    timestamp?: number
  ) => {
    switch (paymentDetails.method) {
      case 'BANK': {
        const { bankIdentifier, accountNumber } = paymentDetails as BankDetails
        return {
          PartitionKeyID: `${tenantId}#transaction#bankIdentifier:${bankIdentifier}#accountNumber:${accountNumber}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'CARD': {
        const { cardFingerprint } = paymentDetails as CardDetails
        return {
          PartitionKeyID: `${tenantId}#transaction#cardFingerprint:${cardFingerprint}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      default:
        throw new Error('Unsupported payment method!')
    }
  },
  // Attributes: [transactionId]
  USER_TRANSACTION: (
    tenantId: string,
    userId: string,
    direction: 'sending' | 'receiving',
    timestamp?: number
  ) => ({
    PartitionKeyID: `${tenantId}#transaction#${USER_ID_PREFIX}${userId}#${direction}`,
    SortKeyID: `${timestamp}`,
  }),
  // Attributes: refer to RuleInstance
  RULE_INSTANCE: (tenantId: string, ruleInstanceId?: string) => ({
    PartitionKeyID: `${tenantId}#rule-instance`,
    SortKeyID: ruleInstanceId,
  }),
  // Attributes: refer to UserAggregationAttributes
  USER_AGGREGATION: (tenantId: string, userId: string) => ({
    PartitionKeyID: `${tenantId}#aggregation#${USER_ID_PREFIX}${userId}`,
    SortKeyID: userId,
  }),
  // Attributes: refer to User / Business
  USER: (tenantId: string, userId: string) => ({
    PartitionKeyID: `${tenantId}#user#${userId}`,
    SortKeyID: userId,
  }),
  LIST: (tenantId: string, listName: string, indexName: string) => ({
    PartitionKeyID: `${tenantId}#list:${listName}`,
    SortKeyID: indexName,
  }),
}

export function keyHasUserId(key: string) {
  return key.includes(USER_ID_PREFIX)
}
