/**
 * DynamoDB Keys (partition key + sort key) Definitions:
 * We consolidate the DynamoDB keys in this file to be more maintainbable and reviewable.
 * The index key design will be a critical part of our system as it'll severely impact
 * the query performance and our AWS cost.
 */

import { FLAGRIGHT_TENANT_ID } from '../constants'
import { logger } from '../logger'
import { ACHDetails } from '@/@types/openapi-public/ACHDetails'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { UPIDetails } from '@/@types/openapi-public/UPIDetails'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { UserEventTypeEnum } from '@/@types/openapi-public/UserEvent'
import { WalletDetails } from '@/@types/openapi-public/WalletDetails'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { SWIFTDetails } from '@/@types/openapi-public/SWIFTDetails'

const TRANSACTION_ID_PREFIX = 'transaction:'
const USER_ID_PREFIX = 'user:'
const TYPE_PREFIX = 'type:'

export type TimeGranularity = 'day' | 'month' | 'year'
export type TenantSettingName = 'features' | 'ruleActionAliases'

export const DynamoDbKeys = {
  // Attributes: refer to Transaction
  TRANSACTION: (tenantId: string, transactionId?: string) => ({
    PartitionKeyID: `${tenantId}#transaction#primary`,
    SortKeyID: transactionId,
  }),
  // Attributes: refer to TransactionEvent
  TRANSACTION_EVENT: (
    tenantId: string,
    transactionId: string,
    timestamp?: number
  ) => ({
    PartitionKeyID: `${tenantId}#transaction-event#${TRANSACTION_ID_PREFIX}${transactionId}`,
    SortKeyID: `${timestamp}`,
  }),
  ALL_TRANSACTION: (
    tenantId: string,
    userId: string | undefined,
    paymentDetails: PaymentDetails | undefined,
    direction: 'sending' | 'receiving',
    transactionType?: string,
    timestamp?: number
  ) => {
    return userId === undefined
      ? paymentDetails &&
          DynamoDbKeys.NON_USER_TRANSACTION(
            tenantId,
            paymentDetails,
            direction,
            transactionType,
            timestamp
          )
      : DynamoDbKeys.USER_TRANSACTION(
          tenantId,
          userId,
          direction,
          transactionType,
          timestamp
        )
  },
  // Attributes: [transactionId]
  NON_USER_TRANSACTION: (
    tenantId: string,
    paymentDetails: PaymentDetails,
    direction: 'sending' | 'receiving',
    transactionType?: string,
    timestamp?: number
  ) => {
    const tranasctionTypeKey = getTransactionTypeKey(transactionType)
    switch (paymentDetails.method) {
      case 'IBAN': {
        const { BIC, IBAN } = paymentDetails as IBANDetails
        if (!BIC || !IBAN) {
          logger.warn('Unable to identify the anonymous user')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#BIC:${BIC}#IBAN:${IBAN}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'CARD': {
        const { cardFingerprint } = paymentDetails as CardDetails
        if (!cardFingerprint) {
          logger.warn('Unable to identify the anonymous user')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#cardFingerprint:${cardFingerprint}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'ACH': {
        const { routingNumber, accountNumber } = paymentDetails as ACHDetails
        if (!routingNumber || !accountNumber) {
          logger.warn('Unable to identify the anonymous user')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#routingNumber:${routingNumber}#accountNumber:${accountNumber}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'UPI': {
        const { upiID } = paymentDetails as UPIDetails
        if (!upiID) {
          logger.warn('Unable to identify the anonymous user')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#upiID:${upiID}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'WALLET': {
        const { walletId } = paymentDetails as WalletDetails
        if (!walletId) {
          logger.warn('Unable to identify the anonymous user')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#walletId:${walletId}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'GENERIC_BANK_ACCOUNT': {
        const { accountNumber, accountType } =
          paymentDetails as GenericBankAccountDetails
        if (!accountNumber || !accountType) {
          logger.warn('Unable to identify the anonymous user')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#accountNumber:${accountNumber}#accountType:${accountType}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'SWIFT': {
        const { accountNumber, swiftCode } = paymentDetails as SWIFTDetails
        if (!accountNumber || !swiftCode) {
          logger.warn('Unable to identify the anonymous user')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#accountNumber:${accountNumber}#swiftCode:${swiftCode}#${direction}`,
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
    transactionType?: string,
    timestamp?: number
  ) => {
    const tranasctionTypeKey = getTransactionTypeKey(transactionType)
    return {
      PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#${USER_ID_PREFIX}${userId}#${direction}`,
      SortKeyID: `${timestamp}`,
    }
  },
  IP_ADDRESS_TRANSACTION: (
    tenantId: string,
    ipAddress: string,
    timestamp?: number
  ) => ({
    PartitionKeyID: `${tenantId}#transaction#ip:${ipAddress}`,
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
  // Attributes: refer to UserAggregationAttributes
  USER_TIME_AGGREGATION: (
    tenantId: string,
    userId: string,
    // e.g 2022-01-01, 2022-01, 2022
    timeLabel?: string
  ) => ({
    PartitionKeyID: `${tenantId}#aggregation#${USER_ID_PREFIX}${userId}#time`,
    SortKeyID: timeLabel,
  }),
  // Attributes: refer to User / Business
  USER: (tenantId: string, userId?: string) => ({
    PartitionKeyID: `${tenantId}#user#primary`,
    SortKeyID: userId,
  }),
  // Attributes: refer to UserEvent
  USER_EVENT: (
    tenantId: string,
    eventType: UserEventTypeEnum,
    userId: string,
    timestamp?: number
  ) => ({
    PartitionKeyID: `${tenantId}#user-event#${TYPE_PREFIX}${eventType}#${USER_ID_PREFIX}${userId}`,
    SortKeyID: `${timestamp}`,
  }),
  LIST: (tenantId: string, listName: string, indexName: string) => ({
    PartitionKeyID: `${tenantId}#list:${listName}`,
    SortKeyID: indexName,
  }),
  TENANT_SETTINGS: (tenantId: string) => ({
    PartitionKeyID: `${tenantId}#settings`,
    SortKeyID: 'settings',
  }),
  /** Hammerhead keys */
  // Attributes: refer to Rule
  RISK_CLASSIFICATION: (tenantId: string, version?: string) => ({
    PartitionKeyID: `${tenantId}#risk-classification-values`,
    SortKeyID: version,
  }),
  DRS_RISK_DETAILS: (tenantId: string, userId: string, version?: string) => ({
    PartitionKeyID: `${tenantId}#userId#${userId}#drs-value`,
    SortKeyID: version,
  }),
  RULE_PARAMETER_RISK_SCORES_DETAILS: (
    tenantId: string,
    parameter?: string
  ) => ({
    PartitionKeyID: `${tenantId}#rule-parameter-scores`,
    SortKeyID: parameter,
  }),
}

function getTransactionTypeKey(transactionType: string | undefined): string {
  return `${TYPE_PREFIX}${transactionType || 'all'}`
}

export function keyHasUserId(key: string) {
  return key.includes(USER_ID_PREFIX)
}
