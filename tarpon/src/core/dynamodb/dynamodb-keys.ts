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
import { CashDetails } from '@/@types/openapi-public/CashDetails'
import { RiskEntityType } from '@/@types/openapi-internal/RiskEntityType'
import { PaymentMethod } from '@/@types/openapi-public/PaymentMethod'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { getPaymentDetailsIdentifiersKey } from '@/services/logic-evaluator/variables/payment-details'

const TRANSACTION_ID_PREFIX = 'transaction:'
const USER_ID_PREFIX = 'user:'
const TYPE_PREFIX = 'type:'
const RULE_INSTANCE_PREFIX = 'rule:'
const QUESTION_ID_PREFIX = 'question:'

export type TimeGranularity = 'day' | 'month' | 'year'
export type TenantSettingName = keyof TenantSettings
export const TRANSACTION_PRIMARY_KEY_IDENTIFIER = 'transaction#primary'
export const USER_PRIMARY_KEY_IDENTIFIER = 'user#primary'
export const CONSUMER_USER_EVENT_KEY_IDENTIFIER = 'consumer-user-event#'
export const BUSINESS_USER_EVENT_KEY_IDENTIFIER = 'business-user-event#'
export const TRANSACTION_EVENT_KEY_IDENTIFIER = 'transaction-event#'
export const KRS_KEY_IDENTIFIER = '#krs-value'
export const ARS_KEY_IDENTIFIER = '#ars-value'
export const AVG_ARS_KEY_IDENTIFIER = '#avg-ars-value'
export const DRS_KEY_IDENTIFIER = '#drs-value'
export const RULE_INSTANCE_IDENTIFIER = 'rule-instance#'
export const SHARED_PARTITION_KEY_PREFIX = 'shared'

type AuxiliaryIndexTransactionSortKeyData = {
  timestamp: number
  transactionId: string
}

function getAuxiliaryIndexTransactionSortKey(
  sortKeyData?: AuxiliaryIndexTransactionSortKeyData
) {
  if (!sortKeyData) {
    return ''
  }
  return `${sortKeyData.timestamp}-${sortKeyData.transactionId}`
}

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
    sortKeyData?: AuxiliaryIndexTransactionSortKeyData
  ) => {
    return userId === undefined
      ? paymentDetails &&
          DynamoDbKeys.NON_USER_TRANSACTION(
            tenantId,
            paymentDetails,
            direction,
            transactionType,
            sortKeyData
          )
      : DynamoDbKeys.USER_TRANSACTION(
          tenantId,
          userId,
          direction,
          transactionType,
          sortKeyData
        )
  },
  // Attributes: [transactionId]
  NON_USER_TRANSACTION: (
    tenantId: string,
    paymentDetails: PaymentDetails,
    direction: 'sending' | 'receiving' | 'all',
    transactionType?: string,
    sortKeyData?: AuxiliaryIndexTransactionSortKeyData
  ) => {
    const tranasctionTypeKey = getTransactionTypeKey(transactionType)
    const identifiers = getPaymentDetailsIdentifiers(paymentDetails)
    if (!identifiers) {
      return null
    }
    if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
      const { accountNumber, accountType, bankCode, bankId } = identifiers
      // We keep the legacy identifier to avoid migrating data in DynamoDB
      const legacyIdentifier =
        accountNumber && accountType
          ? `accountNumber:${accountNumber}#accountType:${accountType}`
          : undefined
      const identifier =
        legacyIdentifier ??
        [accountNumber, bankCode ?? bankId].filter(Boolean).join('.')

      if (!identifier) {
        return null
      }
      return {
        PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#${identifier}#${direction}`,
        SortKeyID: getAuxiliaryIndexTransactionSortKey(sortKeyData),
      }
    } else {
      return {
        PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#paymentDetails#${getPaymentDetailsIdentifiersKey(
          paymentDetails
        )}#${direction}`,
        SortKeyID: getAuxiliaryIndexTransactionSortKey(sortKeyData),
      }
    }
  },
  // Attributes: [transactionId]
  USER_TRANSACTION: (
    tenantId: string,
    userId: string,
    direction: 'sending' | 'receiving' | 'all',
    transactionType?: string,
    sortKeyData?: AuxiliaryIndexTransactionSortKeyData
  ) => {
    const tranasctionTypeKey = getTransactionTypeKey(transactionType)
    return {
      PartitionKeyID: `${tenantId}#transaction#${tranasctionTypeKey}#${USER_ID_PREFIX}${userId}#${direction}`,
      SortKeyID: getAuxiliaryIndexTransactionSortKey(sortKeyData),
    }
  },
  ORIGIN_IP_ADDRESS_TRANSACTION: (
    tenantId: string,
    ipAddress: string,
    sortKeyData?: AuxiliaryIndexTransactionSortKeyData
  ) => ({
    PartitionKeyID: `${tenantId}#transaction#ip:${ipAddress}`,
    SortKeyID: getAuxiliaryIndexTransactionSortKey(sortKeyData),
  }),
  DESTINATION_IP_ADDRESS_TRANSACTION: (
    tenantId: string,
    ipAddress: string,
    sortKeyData?: AuxiliaryIndexTransactionSortKeyData
  ) => ({
    PartitionKeyID: `${tenantId}#transaction#destination_ip:${ipAddress}`,
    SortKeyID: getAuxiliaryIndexTransactionSortKey(sortKeyData),
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
  // Currency Cache
  CURRENCY_CACHE: () => ({
    PartitionKeyID: `${FLAGRIGHT_TENANT_ID}#currency-cache`,
    SortKeyID: '1',
  }),
  // IP address cache
  IP_ADDRESS_CACHE: (ipAddress: string) => ({
    PartitionKeyID: `${SHARED_PARTITION_KEY_PREFIX}#ip#${ipAddress}`,
    SortKeyID: '',
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
    timeLabel?: string,
    version?: number
  ) => ({
    PartitionKeyID:
      `${tenantId}#aggregation#${USER_ID_PREFIX}${userId}#time` +
      (version ?? ''),
    SortKeyID: timeLabel,
  }),
  RULE_USER_TIME_AGGREGATION_LATEST_AVAILABLE_VERSION: (
    tenantId: string,
    ruleInstanceId: string,
    userKeyId?: string
  ) => ({
    PartitionKeyID: `${tenantId}#aggregation#${RULE_INSTANCE_PREFIX}${ruleInstanceId}#version`,
    SortKeyID: userKeyId,
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
  V8_LOGIC_USER_TIME_AGGREGATION_TX_MARKER: (
    tenantId: string,
    direction: 'origin' | 'destination',
    version: string,
    transactionId: string
  ) => ({
    PartitionKeyID: `${tenantId}#rule-agg#${direction}#${version}#${transactionId}`,
    SortKeyID: '1',
  }),
  // TODO (V8): Improve user key ID format for V8 only
  V8_LOGIC_USER_TIME_AGGREGATION_READY_MARKER: (
    tenantId: string,
    userKeyId: string,
    version: string
  ) => ({
    PartitionKeyID: `${tenantId}#rule-agg#${version}#${USER_ID_PREFIX}${userKeyId}`,
    SortKeyID: '1',
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
  V8_LOGIC_USER_TIME_AGGREGATION: (
    tenantId: string,
    userKeyId: string,
    version: string,
    groupValue: string | undefined,
    timeLabel?: string
  ) => {
    const groupSuffix = groupValue ? `#${groupValue}` : ''
    return {
      PartitionKeyID: `${tenantId}#rule-agg#${USER_ID_PREFIX}${userKeyId}#${version}${groupSuffix}`,
      SortKeyID: timeLabel,
    }
  },
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
  LIST_HEADER: (tenantId: string, listId?: string) => ({
    PartitionKeyID: `${tenantId}#lists`,
    SortKeyID: `${listId}`,
  }),
  LIST_DELETED: (tenantId: string, listId?: string) => ({
    PartitionKeyID: `${tenantId}#deleted#lists`,
    SortKeyID: `${listId}`,
  }),
  LIST_ITEM: (tenantId: string, listId: string, key?: string) => ({
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
  PARAMETER_RISK_SCORES_DETAILS_V8: (
    tenantId: string,
    parameterId?: string
  ) => ({
    PartitionKeyID: `${tenantId}#risk-factors`,
    SortKeyID: parameterId,
  }),
  RISK_FACTOR: (tenantId: string, riskFactorId?: string) => ({
    PartitionKeyID: `${tenantId}#risk-factors-v8`,
    SortKeyID: riskFactorId,
  }),
  KRS_VALUE_ITEM: (tenantId: string, userId: string, version: string) => ({
    PartitionKeyID: `${tenantId}#${USER_ID_PREFIX}${userId}${KRS_KEY_IDENTIFIER}`,
    SortKeyID: version,
  }),
  CACHE_QUESTION_RESULT: (
    tenantId: string,
    questionId: string,
    alertId: string,
    variableHash: string,
    questionVersion?: number
  ) => ({
    PartitionKeyID: `${tenantId}#${QUESTION_ID_PREFIX}${questionId}-${alertId}${
      questionVersion ? `:v${questionVersion}` : ''
    }`,
    SortKeyID: variableHash,
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
  AVG_ARS_VALUE_ITEM: (tenantId: string, userId: string, version: string) => ({
    PartitionKeyID: `${tenantId}#${USER_ID_PREFIX}${userId}${AVG_ARS_KEY_IDENTIFIER}`,
    SortKeyID: version,
  }),
  AGGREGATION_VARIABLE: (tenantId: string, aggHash: string) => ({
    PartitionKeyID: `${tenantId}#aggvar`,
    SortKeyID: aggHash,
  }),
  SLACK_ALERTS_TIMESTAMP_MARKER: (tenantId: string) => ({
    PartitionKeyID: `${tenantId}#slack-notifications`,
    SortKeyID: `marker`,
  }),
  AVG_ARS_READY_MARKER: (tenantId: string) => ({
    PartitionKeyID: `${tenantId}#avg-ars-ready`,
    SortKeyID: '1',
  }),
}

export type DynamoDbKeyEnum = keyof typeof DynamoDbKeys

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
  | Array<keyof CashDetails>
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
  CASH: ['identifier'],
}

export function getPaymentMethodId(
  pm: PaymentDetails | undefined
): string | undefined {
  if (!pm) {
    return
  }
  switch (pm.method) {
    case 'ACH':
      return pm.accountNumber
    case 'CARD':
      return pm.cardFingerprint
    case 'GENERIC_BANK_ACCOUNT':
      return pm.accountNumber
    case 'WALLET':
      return pm.walletId
    case 'CHECK':
      return pm.checkIdentifier
    case 'IBAN':
      return pm.IBAN
    case 'MPESA':
      return pm.phoneNumber
    case 'SWIFT':
      return pm.accountNumber
    case 'UPI':
      return pm.upiID
    case 'CASH':
      return pm.identifier
  }
}

export function getBankname(
  paymentMethodDetails?: PaymentDetails
): string | undefined {
  if (
    paymentMethodDetails?.method === 'IBAN' ||
    paymentMethodDetails?.method === 'SWIFT' ||
    paymentMethodDetails?.method === 'GENERIC_BANK_ACCOUNT' ||
    paymentMethodDetails?.method === 'ACH'
  ) {
    return paymentMethodDetails.bankName
  }
}

export function getPaymentDetailsIdentifiers(
  paymentDetails: PaymentDetails
): { [key: string]: string | undefined } | null {
  const identifierFields =
    PAYMENT_METHOD_IDENTIFIER_FIELDS[paymentDetails.method]

  if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
    const { accountNumber, accountType, bankCode } =
      paymentDetails as GenericBankAccountDetails
    // legacy identifier
    if (accountNumber && accountType) {
      return {
        accountNumber,
        accountType,
      }
    }
    if (!accountNumber) {
      return null
    }

    return {
      accountNumber,
      bankCode,
      // NOTE: bankId is currently being sent by Kevin. We'll ask them to send bankCode
      // instead later
      bankId: (paymentDetails as any).bankId,
    }
  } else {
    // All fields need to be non-empty
    if (identifierFields.length === 0) {
      logger.error(
        `Payment identifier fields not found for ${paymentDetails.method}`
      )
    }

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
