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
import { WalletDetails } from '@/@types/openapi-public/WalletDetails'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { SWIFTDetails } from '@/@types/openapi-public/SWIFTDetails'
import { MpesaDetails } from '@/@types/openapi-public/MpesaDetails'
import { CheckDetails } from '@/@types/openapi-public/CheckDetails'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'

const TRANSACTION_ID_PREFIX = 'transaction:'
const USER_ID_PREFIX = 'user:'
const TYPE_PREFIX = 'type:'
const RULE_INSTANCE_PREFIX = 'rule:'

export type TimeGranularity = 'day' | 'month' | 'year'
export type TenantSettingName =
  | 'features'
  | 'ruleActionAliases'
  | 'transactionStateAliases'

export const TRANSACTION_PRIMARY_KEY_IDENTIFIER = 'transaction#primary'
export const USER_PRIMARY_KEY_IDENTIFIER = 'user#primary'
export const CONSUMER_USER_EVENT_KEY_IDENTIFIER = 'consumer-user-event#'
export const BUSINESS_USER_EVENT_KEY_IDENTIFIER = 'business-user-event#'
export const TRANSACTION_EVENT_KEY_IDENTIFIER = 'transaction-event#'
export const KRS_KEY_IDENTIFIER = '#krs-value'
export const ARS_KEY_IDENTIFIER = '#ars-value'
export const DRS_KEY_IDENTIFIER = '#drs-value'

export const DynamoDbKeys = {
  // Attributes: refer to Transaction
  TRANSACTION: (tenantId: string, transactionId?: string) => ({
    PartitionKeyID: `${tenantId}#${TRANSACTION_PRIMARY_KEY_IDENTIFIER}`,
    SortKeyID: transactionId,
  }),
  // Attributes: refer to TransactionEvent
  TRANSACTION_EVENT: (
    tenantId: string,
    transactionId: string,
    timestamp?: number
  ) => ({
    PartitionKeyID: `${tenantId}#${TRANSACTION_EVENT_KEY_IDENTIFIER}${TRANSACTION_ID_PREFIX}${transactionId}`,
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
          logger.warn('Payment identifier not found: BIC or IBAN')
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
          logger.warn('Payment identifier not found: Card fingerprint')
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
          logger.warn('Payment identifier not found: Routing or account number')
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
          logger.warn('Payment identifier not found: UPI ID')
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
          logger.warn('Payment identifier not found: WalletID')
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
          logger.warn('Payment identifier not found: Account number or type')
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
          logger.warn('Payment identifier not found: Acc number ot SWIFT Code')
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#accountNumber:${accountNumber}#swiftCode:${swiftCode}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'MPESA': {
        const { businessShortCode, phoneNumber } =
          paymentDetails as MpesaDetails
        if (!businessShortCode || !phoneNumber) {
          logger.warn(
            'Payment identifier not found: Phone number or Business Code'
          )
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#phoneNumber:${phoneNumber}#businessShortCode:${businessShortCode}#${direction}`,
          SortKeyID: `${timestamp}`,
        }
      }
      case 'CHECK': {
        const { checkIdentifier, checkNumber } = paymentDetails as CheckDetails
        if (!checkIdentifier || !checkNumber) {
          logger.warn(
            'Payment identifier not found: check identifier or check number'
          )
          return null
        }
        return {
          PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#checkIdentifier:${checkIdentifier}#checkNumber:${checkNumber}#${direction}`,
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
    // e.g 2022-01-01, 2022-W10, 2022-01, 2022
    timeLabel?: string
  ) => ({
    PartitionKeyID: `${tenantId}#aggregation#${USER_ID_PREFIX}${userId}#time`,
    SortKeyID: timeLabel,
  }),
  RULE_USER_TIME_AGGREGATION_MARKER: (
    tenantId: string,
    ruleInstanceId: string,
    direction: 'origin' | 'destination',
    version: string,
    transactionId: string
  ) => ({
    PartitionKeyID: `${tenantId}#aggregation#${RULE_INSTANCE_PREFIX}${ruleInstanceId}#${direction}#${version}#marker`,
    SortKeyID: transactionId,
  }),
  RULE_USER_TIME_AGGREGATION: (
    tenantId: string,
    userKeyId: string,
    ruleInstanceId: string,
    direction: 'origin' | 'destination',
    version: string,
    timeLabel?: string
  ) => ({
    PartitionKeyID: `${tenantId}#aggregation#${USER_ID_PREFIX}${userKeyId}#${RULE_INSTANCE_PREFIX}${ruleInstanceId}#${direction}#${version}`,
    SortKeyID: timeLabel,
  }),
  // Attributes: refer to User / Business
  USER: (tenantId: string, userId?: string) => ({
    PartitionKeyID: `${tenantId}#${USER_PRIMARY_KEY_IDENTIFIER}`,
    SortKeyID: userId,
  }),
  // Attributes: refer to UserEvent
  CONSUMER_USER_EVENT: (
    tenantId: string,
    userId: string,
    timestamp?: number
  ) => ({
    PartitionKeyID: `${tenantId}#${CONSUMER_USER_EVENT_KEY_IDENTIFIER}${USER_ID_PREFIX}${userId}`,
    SortKeyID: `${timestamp}`,
  }),
  BUSINESS_USER_EVENT: (
    tenantId: string,
    userId: string,
    timestamp?: number
  ) => ({
    PartitionKeyID: `${tenantId}#${BUSINESS_USER_EVENT_KEY_IDENTIFIER}${USER_ID_PREFIX}${userId}`,
    SortKeyID: `${timestamp}`,
  }),
  LIST_HEADER: (tenantId: string, listId: string) => ({
    PartitionKeyID: `${tenantId}#lists`,
    SortKeyID: `${listId}`,
  }),
  LIST_DELETED: (tenantId: string, listId: string) => ({
    PartitionKeyID: `${tenantId}#deleted#lists`,
    SortKeyID: `${listId}`,
  }),
  LIST_ITEM: (tenantId: string, listId: string, key: string) => ({
    PartitionKeyID: `${tenantId}#list-item#${listId}`,
    SortKeyID: key,
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
  PARAMETER_RISK_SCORES_DETAILS: (
    tenantId: string,
    parameter?: string,
    entityType?: RiskEntityType
  ) => ({
    PartitionKeyID: `${tenantId}#provided-parameter-risk-values`,
    SortKeyID: `${entityType}#${parameter}`,
  }),
  KRS_VALUE_ITEM: (tenantId: string, userId: string, version: string) => ({
    PartitionKeyID: `${tenantId}#${USER_ID_PREFIX}${userId}${KRS_KEY_IDENTIFIER}`,
    SortKeyID: version,
  }),
  DRS_VALUE_ITEM: (tenantId: string, userId: string, version: string) => ({
    PartitionKeyID: `${tenantId}#${USER_ID_PREFIX}${userId}${DRS_KEY_IDENTIFIER}`,
    SortKeyID: version,
  }),
  ARS_VALUE_ITEM: (
    tenantId: string,
    transactionId: string,
    version: string
  ) => ({
    PartitionKeyID: `${tenantId}#${TRANSACTION_ID_PREFIX}${transactionId}${ARS_KEY_IDENTIFIER}`,
    SortKeyID: version,
  }),
}

function getTransactionTypeKey(transactionType: string | undefined): string {
  return `${TYPE_PREFIX}${transactionType || 'all'}`
}
