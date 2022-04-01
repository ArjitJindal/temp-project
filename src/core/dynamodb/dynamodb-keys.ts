/**
 * DynamoDB Keys (partition key + sort key) Definitions:
 * We consolidate the DynamoDB keys in this file to be more maintainbable and reviewable.
 * The index key design will be a critical part of our system as it'll severely impact
 * the query performance and our AWS cost.
 */

import { FLAGRIGHT_TENANT_ID } from '../constants'
import { ACHDetails } from '@/@types/openapi-public/ACHDetails'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { UPIDetails } from '@/@types/openapi-public/UPIDetails'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

const USER_ID_PREFIX = 'user:'

export const DynamoDbKeys = {
  TENANT: (tenantId: string) => ({
    PartitionKeyID: `${tenantId}#transaction#primary`,
  }),
  // Attributes: refer to Transaction
  TRANSACTION: (tenantId: string, transactionId: string) => ({
    PartitionKeyID: `${tenantId}#transaction#primary`,
    SortKeyID: transactionId,
  }),
  ALL_TRANSACTION: (
    tenantId: string,
    userId: string | undefined,
    paymentDetails: PaymentDetails,
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
    paymentDetails: PaymentDetails,
    direction: 'sending' | 'receiving',
    timestamp?: number
  ) => {
    switch (paymentDetails.method) {
      case 'IBAN': {
        const { BIC, IBAN } = paymentDetails as IBANDetails
        return {
          PartitionKeyID: `${tenantId}#transaction#paymentDetails#BIC:${BIC}#IBAN:${IBAN}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'CARD': {
        const { cardFingerprint } = paymentDetails as CardDetails
        return {
          PartitionKeyID: `${tenantId}#transaction#paymentDetails#cardFingerprint:${cardFingerprint}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'ACH': {
        const { routingNumber, accountNumber } = paymentDetails as ACHDetails
        return {
          PartitionKeyID: `${tenantId}#transaction#paymentDetails#routingNumber:${routingNumber}#accountNumber:${accountNumber}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'UPI': {
        const { upiID } = paymentDetails as UPIDetails
        return {
          PartitionKeyID: `${tenantId}#transaction#paymentDetails#upiID:${upiID}#${direction}`,
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
  // Attributes: refer to Rule
  RULE: (ruleId?: string) => ({
    PartitionKeyID: `${FLAGRIGHT_TENANT_ID}#rule`,
    SortKeyID: ruleId,
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
    PartitionKeyID: `${tenantId}#user#primary`,
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
