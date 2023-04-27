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
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'

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
export const DEVICE_DATA_METRICS_KEY_IDENTIFIER = 'device-metrics-data#'
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
    direction: 'sending' | 'receiving' | 'all',
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
    direction: 'sending' | 'receiving' | 'all',
    transactionType?: string,
    timestamp?: number
  ) => {
    const tranasctionTypeKey = getTransactionTypeKey(transactionType)
    if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
      const { accountNumber, accountType } =
        paymentDetails as GenericBankAccountDetails
      let bankCode = paymentDetails.bankCode

      // NOTE: bankId is currently being sent by Kevin. We'll ask them to send bankCode
      // instead later
      if (!bankCode) {
        bankCode = (paymentDetails as any).bankId
      }
      // We keep the legacy identifier to avoid migrating data in DynamoDB
      const legacyIdentifier =
        accountNumber && accountType
          ? `accountNumber:${accountNumber}#accountType:${accountType}`
          : undefined
      const identifier =
        legacyIdentifier ?? [accountNumber, bankCode].filter(Boolean).join('.')

      if (!identifier) {
        logger.warn('Payment identifier not found')
        return null
      }
      return {
        PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#${identifier}#${direction}`,
        SortKeyID: `${timestamp}`,
      }
    } else {
      const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
      if (!identifiers) {
        return null
      }
      const identifiersString = Object.entries(identifiers)
        .map((entry) => `${entry[0]}:${entry[1]}`)
        .join('#')
      return {
        PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#${identifiersString}#${direction}`,
        SortKeyID: `${timestamp}`,
      }
    }
  },
  // Attributes: [transactionId]
  USER_TRANSACTION: (
    tenantId: string,
    userId: string,
    direction: 'sending' | 'receiving' | 'all',
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
    version: string,
    timeLabel?: string
  ) => ({
    PartitionKeyID: `${tenantId}#aggregation#${USER_ID_PREFIX}${userKeyId}#${RULE_INSTANCE_PREFIX}${ruleInstanceId}#${version}`,
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

  /** Device Metrics Keys */
  DEVICE_DATA_METRICS: (
    tenantId: string,
    userId: string,
    type: string,
    timestamp: number
  ) => ({
    PartitionKeyID: `${tenantId}#device-metrics-data#${userId}`,
    SortKeyID: `${type}#${timestamp}`,
  }),
}

export const PAYMENT_METHOD_IDENTIFIER_FIELDS: Record<
  PaymentMethod,
  | Array<keyof IBANDetails>
  | Array<keyof CardDetails>
  | Array<keyof ACHDetails>
  | Array<keyof UPIDetails>
  | Array<keyof WalletDetails>
  | Array<keyof GenericBankAccountDetails>
  | Array<keyof SWIFTDetails>
  | Array<keyof MpesaDetails>
  | Array<keyof CheckDetails>
> = {
  IBAN: ['BIC', 'IBAN'],
  CARD: ['cardFingerprint'],
  ACH: ['routingNumber', 'accountNumber'],
  UPI: ['upiID'],
  WALLET: ['walletId'],
  GENERIC_BANK_ACCOUNT: ['accountNumber', 'accountType', 'bankCode'],
  SWIFT: ['accountNumber', 'swiftCode'],
  MPESA: ['businessShortCode', 'phoneNumber'],
  CHECK: ['checkIdentifier', 'checkNumber'],
}

export function getPaymentDetailsIdentifiers(
  paymentDetails: PaymentDetails
): { [key: string]: string | undefined } | null {
  const identifierFields =
    PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentDetails.method]

  if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
    const { accountNumber, accountType, bankCode } =
      paymentDetails as GenericBankAccountDetails
    if (!accountNumber && !accountType && !bankCode) {
      return null
    }
    return {
      accountNumber,
      accountType,
      bankCode,
    }
  } else {
    // All fields need to be non-empty
    if (
      (identifierFields as string[]).find(
        (field) => !(paymentDetails as any)[field]
      )
    ) {
      return null
    }
    return Object.fromEntries(
      identifierFields.map((field) => [field, (paymentDetails as any)[field]])
    )
  }
}

function getTransactionTypeKey(transactionType: string | undefined): string {
  return `${TYPE_PREFIX}${transactionType || 'all'}`
}
