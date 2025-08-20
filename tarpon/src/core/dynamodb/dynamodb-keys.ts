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
import { generateChecksum } from '@/utils/object'
import dayjs from '@/utils/dayjs'
import { CRMModelType } from '@/@types/openapi-internal/CRMModelType'
import { NPPDetails } from '@/@types/openapi-public/NPPDetails'
import { ReasonType } from '@/@types/openapi-internal/ReasonType'

const TRANSACTION_ID_PREFIX = 'transaction:'
const USER_ID_PREFIX = 'user:'
const TYPE_PREFIX = 'type:'
const RULE_INSTANCE_PREFIX = 'rule:'
const QUESTION_ID_PREFIX = 'question:'
export const ALERT_ID_PREFIX = 'alert:'
export const CASE_ID_PREFIX = 'case:'
const WORKFLOWS_PREFIX = 'workflow'
export const BATCH_TRANSACTIONS_IDENTIFIER = 'transactions-batch'
export const BATCH_TRANSACTION_EVENTS_IDENTIFIER = 'transaction-events-batch'
export const BATCH_CONSUMER_USERS_IDENTIFIER = 'consumer-users-batch'
export const BATCH_CONSUMER_USER_EVENTS_IDENTIFIER =
  'consumer-user-events-batch'
export const BATCH_BUSINESS_USERS_IDENTIFIER = 'business-users-batch'
export const BATCH_BUSINESS_USER_EVENTS_IDENTIFIER =
  'business-user-events-batch'

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
export const SHARED_AUTH0_PARTITION_KEY_PREFIX = 'shared-auth0'
export const ALERT_KEY_IDENTIFIER = '#alert-data'
export const ALERT_COMMENT_KEY_IDENTIFIER = '#alert-comment'
export const ALERT_FILE_ID_IDENTIFIER = '#alert-file'
export const CASE_KEY_IDENTIFIER = '#cases'
export const CASE_COMMENT_KEY_IDENTIFIER = '#case-comment'
export const CASE_COMMENT_FILE_KEY_IDENTIFIER = '#case-comment-file'
export const CASE_SUBJECT_KEY_IDENTIFIER = '#case-subject'
export const CASE_TRANSACTION_IDS_KEY_IDENTIFIER = '#case-transaction-ids'
export const ALERT_TRANSACTION_IDS_KEY_IDENTIFIER = '#alert-transaction-ids'
export const CRM_RECORD_KEY_IDENTIFIER = '#crm-record'
export const CRM_RECORD_MODEL_KEY_IDENTIFIER = '#crm-record-model'
export const CRM_USER_RECORD_LINK_KEY_IDENTIFIER = '#crm-user-record-link'
export const COUNTER_KEY_IDENTIFIER = '#counter'
export const AUDIT_LOGS_KEY_IDENTIFIER = '#audit-logs'
export const ALERTS_QA_SAMPLING_KEY_IDENTIFIER = '#alerts-qa-sampling'
export const NOTIFICATIONS_KEY_IDENTIFIER = '#notification'
export const GPT_REQUESTS_KEY_IDENTIFIER = '#gpt-request-logs'
export const JOBS_KEY_IDENTIFIER = '#jobs'
export const REASONS_KEY_IDENTIFIER = '#reasons'
export const WEBHOOK_CONFIGURATION_KEY_IDENTIFIER = '#webhook'
export const MIGRATION_TMP_KEY_IDENTIFIER = 'migration-tmp'
export const MIGRATION_PRE_DEPLOYMENT_KEY_IDENTIFIER =
  'migrations-pre-deployment'
export const MIGRATION_POST_DEPLOYMENT_KEY_IDENTIFIER =
  'migrations-post-deployment'
export const DYNAMO_CLICKHOUSE_KEY_IDENTIFIER =
  '#dynamo-clickhouse-console-backfill'

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
  // Attributes: refer to Alert
  ALERT: (tenantId: string, alertId: string) => ({
    PartitionKeyID: `${tenantId}${ALERT_KEY_IDENTIFIER}`,
    SortKeyID: alertId,
  }),
  CASE: (tenantId: string, caseId: string) => ({
    PartitionKeyID: `${tenantId}${CASE_KEY_IDENTIFIER}`,
    SortKeyID: caseId,
  }),
  // Attributes: refer to Search Profile
  SEARCH_PROFILE: (tenantId: string, searchProfileId?: string) => ({
    PartitionKeyID: `${tenantId}#search-profile`,
    SortKeyID: searchProfileId,
  }),
  DEFAULT_FILTERS: (tenantId: string) => ({
    PartitionKeyID: `${tenantId}#default-filters`,
    SortKeyID: 'default',
  }),
  SCREENING_PROFILE: (tenantId: string, screeningProfileId?: string) => ({
    PartitionKeyID: `${tenantId}#screening-profile`,
    SortKeyID: screeningProfileId,
  }),
  CRM_RECORD: (tenantId: string, modelName: CRMModelType, id: string) => ({
    PartitionKeyID: `${tenantId}${CRM_RECORD_KEY_IDENTIFIER}#${CRM_RECORD_MODEL_KEY_IDENTIFIER}:${modelName}`,
    SortKeyID: id,
  }),
  CRM_USER_RECORD_LINK: (
    tenantId: string,
    userId: string,
    recordType: string,
    crmName: string,
    crmRecordId: string
  ) => ({
    PartitionKeyID: `${tenantId}${CRM_USER_RECORD_LINK_KEY_IDENTIFIER}#userId:${userId}#recordType:${recordType}#crmName:${crmName}`,
    SortKeyID: crmRecordId,
  }),
  ALERT_COMMENT: (tenantId: string, alertId: string, commentId?: string) => ({
    PartitionKeyID: `${tenantId}${ALERT_COMMENT_KEY_IDENTIFIER}#${ALERT_ID_PREFIX}${alertId}`,
    SortKeyID: commentId,
  }),
  ALERT_COMMENT_FILE: (
    tenantId: string,
    alertId: string,
    commentId?: string,
    fileS3Key?: string
  ) => ({
    PartitionKeyID: `${tenantId}${ALERT_FILE_ID_IDENTIFIER}#${ALERT_ID_PREFIX}${alertId}`,
    SortKeyID: `${commentId}#${fileS3Key}`,
  }),
  ALERT_TRANSACTION_IDS: (tenantId: string, alertId: string) => ({
    PartitionKeyID: `${tenantId}${ALERT_TRANSACTION_IDS_KEY_IDENTIFIER}`,
    SortKeyID: alertId,
  }),
  CASE_ALERT: (tenantId: string, caseId: string, alertId?: string) => ({
    PartitionKeyID: `${tenantId}#alert#${CASE_ID_PREFIX}${caseId}`,
    SortKeyID: alertId,
  }),
  CASE_TRANSACTION_IDS: (tenantId: string, caseId: string) => ({
    PartitionKeyID: `${tenantId}${CASE_TRANSACTION_IDS_KEY_IDENTIFIER}`,
    SortKeyID: caseId,
  }),
  CASE_COMMENT: (tenantId: string, caseId: string, commentId?: string) => ({
    PartitionKeyID: `${tenantId}${CASE_COMMENT_KEY_IDENTIFIER}#${CASE_ID_PREFIX}${caseId}`,
    SortKeyID: commentId,
  }),
  CASE_COMMENT_FILE: (
    tenantId: string,
    caseId: string,
    commentId?: string,
    fileS3Key?: string
  ) => ({
    PartitionKeyID: `${tenantId}${CASE_COMMENT_FILE_KEY_IDENTIFIER}#${CASE_ID_PREFIX}${caseId}`,
    SortKeyID: `${commentId}#${fileS3Key}`,
  }),
  CASE_SUBJECT: (tenantId: string, subjectId: string, caseId?: string) => ({
    PartitionKeyID: `${tenantId}${CASE_SUBJECT_KEY_IDENTIFIER}#${subjectId}`,
    SortKeyID: `${caseId}`,
  }),
  // Attributes: refer to Transaction
  TRANSACTION: (tenantId: string, transactionId?: string) => ({
    PartitionKeyID: `${tenantId}#${TRANSACTION_PRIMARY_KEY_IDENTIFIER}`,
    SortKeyID: transactionId,
  }),
  // Attributes: refer to TransactionEvent
  TRANSACTION_EVENT: (
    tenantId: string,
    transactionId: string,
    sortKeyData?: {
      timestamp: number
      eventId: string
    }
  ) => {
    let sortKeyId = ''
    if (sortKeyData) {
      // Use new format for events created after 2024-11-06
      if (
        sortKeyData.timestamp > dayjs('2024-11-06').valueOf() &&
        sortKeyData.eventId
      ) {
        sortKeyId = `${sortKeyData.timestamp}-${sortKeyData.eventId}`
      } else {
        sortKeyId = `${sortKeyData.timestamp}`
      }
    }
    return {
      PartitionKeyID: `${tenantId}#${TRANSACTION_EVENT_KEY_IDENTIFIER}${TRANSACTION_ID_PREFIX}${transactionId}`,
      SortKeyID: sortKeyId,
    }
  },
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

  SHARED_LOCKS: (lockKey: string) => ({
    PartitionKeyID: `${SHARED_PARTITION_KEY_PREFIX}#lock#${lockKey}`,
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
  LIST_ITEM: (
    tenantId: string,
    listId: string,
    version: number | undefined,
    key?: string
  ) => ({
    PartitionKeyID: `${tenantId}#list-item#${listId}${
      version ? `#v${version}` : ''
    }`,
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
  RISK_CLASSIFICATION_APPROVAL: (tenantId: string, version?: string) => ({
    PartitionKeyID: `${tenantId}#risk-classification-approval`,
    SortKeyID: version,
  }),
  USERS_PROPOSAL: (tenantId: string, userId: string, timestamp?: number) => ({
    PartitionKeyID: `${tenantId}#users-proposal`,
    SortKeyID: `${userId}#${timestamp}`,
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
  RISK_FACTORS_APPROVAL: (tenantId: string, riskFactorId?: string) => ({
    PartitionKeyID: `${tenantId}#risk-factors-approval`,
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
  AGGREGATION_VARIABLE: (tenantId: string, aggHash?: string) => ({
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
  SAR_ITEMS: (tenantId: string, userId: string) => ({
    PartitionKeyID: `${tenantId}#sar-items`,
    SortKeyID: `${userId}`,
  }),
  ACTIVE_SESSIONS: (
    tenantId: string,
    userId: string,
    deviceInfo?: { userAgent: string; deviceFingerprint: string }
  ) => ({
    PartitionKeyID: `${tenantId}#activesessions#${userId}`,
    SortKeyID: generateChecksum(deviceInfo, 5),
  }),
  ACCOUNTS: (auth0Domain: string, accountId: string) => ({
    PartitionKeyID: `${SHARED_AUTH0_PARTITION_KEY_PREFIX}#accounts-id#${auth0Domain}`,
    SortKeyID: accountId,
  }),
  ACCOUNTS_BY_EMAIL: (auth0Domain: string, email: string) => ({
    PartitionKeyID: `${SHARED_AUTH0_PARTITION_KEY_PREFIX}#accounts-email#${auth0Domain}`,
    SortKeyID: email,
  }),
  ORGANIZATION: (auth0Domain: string, tenantId?: string) => ({
    PartitionKeyID: `${SHARED_AUTH0_PARTITION_KEY_PREFIX}#organization-data#${auth0Domain}`,
    SortKeyID: tenantId,
  }),
  ORGANIZATION_ACCOUNTS: (
    auth0Domain: string,
    tenantId: string,
    accountId?: string
  ) => ({
    PartitionKeyID: `${SHARED_AUTH0_PARTITION_KEY_PREFIX}#organization-accounts#${auth0Domain}#tenant#${tenantId}`,
    SortKeyID: accountId,
  }),
  ROLES: (auth0Domain: string, roleId: string) => ({
    PartitionKeyID: `${SHARED_AUTH0_PARTITION_KEY_PREFIX}#roles#${auth0Domain}`,
    SortKeyID: roleId,
  }),
  ROLES_BY_NAMESPACE: (
    auth0Domain: string,
    namespace: string,
    roleId?: string
  ) => ({
    PartitionKeyID: `${SHARED_AUTH0_PARTITION_KEY_PREFIX}#roles-by-namespace:${namespace}#${auth0Domain}`,
    SortKeyID: roleId,
  }),
  ROLES_BY_NAME: (auth0Domain: string, roleName: string) => ({
    PartitionKeyID: `${SHARED_AUTH0_PARTITION_KEY_PREFIX}#roles-by-name#${auth0Domain}`,
    SortKeyID: roleName,
  }),
  RULE_INSTANCE_THRESHOLD_OPTIMIZATION_DATA: (
    tenantId: string,
    ruleInstanceId: string,
    version: string
  ) => ({
    PartitionKeyID: `${tenantId}#instance-threshold-data:${ruleInstanceId}`,
    SortKeyID: version, // To use version in future
  }),
  // Workflow keys
  WORKFLOWS: (
    tenantId: string,
    workflowType: string,
    workflowId?: string,
    version?: string
  ) => ({
    PartitionKeyID: `${tenantId}#${WORKFLOWS_PREFIX}#${workflowType}`,
    SortKeyID: `${workflowId}#${version}`,
  }),
  COUNTER: (tenantId: string, entity: string) => ({
    PartitionKeyID: `${tenantId}${COUNTER_KEY_IDENTIFIER}`,
    SortKeyID: entity,
  }),
  AUDIT_LOGS: (tenantId: string, auditLogId?: string) => ({
    PartitionKeyID: `${tenantId}${AUDIT_LOGS_KEY_IDENTIFIER}`,
    SortKeyID: auditLogId,
  }),
  ALERTS_QA_SAMPLING: (tenantId: string, sampleId: string) => ({
    PartitionKeyID: `${tenantId}${ALERTS_QA_SAMPLING_KEY_IDENTIFIER}`,
    SortKeyID: sampleId,
  }),
  BATCH_TRANSACTION: (tenantId: string, batchId: string) => ({
    PartitionKeyID: `${tenantId}#${BATCH_TRANSACTIONS_IDENTIFIER}`,
    SortKeyID: `${batchId}`,
  }),
  BATCH_TRANSACTION_EVENT: (tenantId: string, batchId: string) => ({
    PartitionKeyID: `${tenantId}#${BATCH_TRANSACTION_EVENTS_IDENTIFIER}`,
    SortKeyID: `${batchId}`,
  }),
  BATCH_CONSUMER_USER: (tenantId: string, batchId: string) => ({
    PartitionKeyID: `${tenantId}#${BATCH_CONSUMER_USERS_IDENTIFIER}`,
    SortKeyID: `${batchId}`,
  }),
  BATCH_CONSUMER_USER_EVENT: (tenantId: string, batchId: string) => ({
    PartitionKeyID: `${tenantId}#${BATCH_CONSUMER_USER_EVENTS_IDENTIFIER}`,
    SortKeyID: `${batchId}`,
  }),
  BATCH_BUSINESS_USER: (tenantId: string, batchId: string) => ({
    PartitionKeyID: `${tenantId}#${BATCH_BUSINESS_USERS_IDENTIFIER}`,
    SortKeyID: `${batchId}`,
  }),
  BATCH_BUSINESS_USER_EVENT: (tenantId: string, batchId: string) => ({
    PartitionKeyID: `${tenantId}#${BATCH_BUSINESS_USER_EVENTS_IDENTIFIER}`,
    SortKeyID: `${batchId}}`,
  }),
  NOTIFICATIONS: (tenantId: string, id: string) => ({
    PartitionKeyID: `${tenantId}${NOTIFICATIONS_KEY_IDENTIFIER}`,
    SortKeyID: id,
  }),
  GPT_REQUESTS: (tenantId: string, id: string) => ({
    PartitionKeyID: `${tenantId}${GPT_REQUESTS_KEY_IDENTIFIER}`,
    SortKeyID: id,
  }),
  JOBS: (tenantId: string, jobId: string) => ({
    PartitionKeyID: `${tenantId}${JOBS_KEY_IDENTIFIER}`,
    SortKeyID: jobId,
  }),
  REASONS: (tenantId: string, id: string, reasonType?: ReasonType) => ({
    PartitionKeyID: `${tenantId}${REASONS_KEY_IDENTIFIER}`,
    SortKeyID: `${reasonType}#${id}`,
  }),
  WEBHOOK_CONFIGURATION: (tenantId: string, webhookId: string) => ({
    PartitionKeyID: `${tenantId}${WEBHOOK_CONFIGURATION_KEY_IDENTIFIER}`,
    SortKeyID: webhookId,
  }),
  MIGRATION_TMP: (id: string) => ({
    PartitionKeyID: `${MIGRATION_TMP_KEY_IDENTIFIER}`,
    SortKeyID: id,
  }),
  MIGRATION_PRE_DEPLOYMENT: (migrationName: string) => ({
    PartitionKeyID: `${MIGRATION_PRE_DEPLOYMENT_KEY_IDENTIFIER}`,
    SortKeyID: migrationName,
  }),
  MIGRATION_POST_DEPLOYMENT: (migrationName: string) => ({
    PartitionKeyID: `${MIGRATION_POST_DEPLOYMENT_KEY_IDENTIFIER}`,
    SortKeyID: migrationName,
  }),
  BATCH_USERS_RERUN_PROGRESS: (tenantId: string, jobId: string) => ({
    PartitionKeyID: `${tenantId}#batch-users-rerun-progress`,
    SortKeyID: jobId,
  }),
  SECONDARY_QUEUE_TENANTS: () => ({
    PartitionKeyID: `${FLAGRIGHT_TENANT_ID}#secondary-queue-tenants`,
    SortKeyID: '1',
  }),
  DYNAMO_CLICKHOUSE: (tenantId: string, entity: string) => ({
    PartitionKeyID: `${tenantId}${DYNAMO_CLICKHOUSE_KEY_IDENTIFIER}`,
    SortKeyID: entity,
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
  | Array<keyof NPPDetails>
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
  NPP: ['payId'],
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
    case 'NPP':
      return pm.payId
  }
}

export function getBankname(
  paymentMethodDetails?: PaymentDetails
): string | undefined {
  if (
    paymentMethodDetails?.method === 'IBAN' ||
    paymentMethodDetails?.method === 'SWIFT' ||
    paymentMethodDetails?.method === 'GENERIC_BANK_ACCOUNT' ||
    paymentMethodDetails?.method === 'ACH' ||
    paymentMethodDetails?.method === 'NPP'
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
