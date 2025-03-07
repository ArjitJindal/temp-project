import { Document } from 'mongodb'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

export const SANCTIONS_SEARCH_INDEX_DEFINITION: Document = {
  mappings: {
    dynamic: false,
    fields: {
      aka: {
        type: 'string',
      },
      associates: {
        type: 'document',
        fields: {
          ranks: {
            type: 'string',
          },
          sanctionsSearchTypes: {
            type: 'string',
          },
        },
      },
      documents: {
        type: 'document',
        fields: {
          id: {
            type: 'string',
          },
          formattedId: {
            type: 'string',
          },
        },
      },
      name: {
        type: 'string',
      },
      gender: {
        type: 'string',
      },
      nationality: {
        type: 'string',
      },
      occupations: {
        type: 'document',
        fields: {
          rank: {
            type: 'string',
          },
        },
      },
      sanctionSearchTypes: {
        type: 'string',
      },
      yearOfBirth: {
        type: 'string',
      },
      entityType: {
        type: 'string',
      },
    },
  },
}

export const MONGO_TABLE_SUFFIX_MAP = {
  TRANSACTIONS: 'transactions',
  USERS: 'users',
  TRANSACTION_EVENTS: 'transaction-events',
  USER_EVENTS: 'user-events',
  CASES: 'cases',
  API_REQUEST_LOGS: 'api-request-logs',
  NARRATIVE_TEMPLATES: 'narrative-templates',
  METRICS: 'metrics',
  COUNTER: 'counter',
  ALERTS_QA_SAMPLING: 'alerts-qa-sampling',
  CRM_ENGAGEMENTS: 'crm-engagements',
  CRM_NOTES: 'crm-notes',
  CRM_TASKS: 'crm-tasks',
  CRM_SUMMARY: 'crm-summary',
  IMPORT: 'import',
  METADATA: 'metadata',
  ACCOUNTS: 'accounts',
  KRS_SCORE: 'kyc-risk-values',
  DRS_SCORE: 'dynamic-risk-values',
  ARS_SCORE: 'action-risk-values',
  SANCTIONS_SCREENING_DETAILS: 'sanctions-screening-details',
  REPORTS: 'report',
}

export const TRANSACTIONS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.TRANSACTIONS}`
}

export const API_REQUEST_LOGS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.API_REQUEST_LOGS}`
}

export const NARRATIVE_TEMPLATE_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.NARRATIVE_TEMPLATES}`
}

export const CASES_COLLECTION = (tenandId: string) => {
  return `${tenandId}-${MONGO_TABLE_SUFFIX_MAP.CASES}`
}

export const METRICS_COLLECTION = (tenandId: string) => {
  return `${tenandId}-${MONGO_TABLE_SUFFIX_MAP.METRICS}`
}

export const COUNTER_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.COUNTER}`
}

export const ALERTS_QA_SAMPLING_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.ALERTS_QA_SAMPLING}`
}

export const CRM_ENGAGEMENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.CRM_ENGAGEMENTS}`
}
export const CRM_NOTES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.CRM_NOTES}`
}

export const CRM_TASKS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.CRM_TASKS}`
}

export const CRM_SUMMARY_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.CRM_SUMMARY}`
}

export const USERS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.USERS}`
}

export const TRANSACTION_EVENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.TRANSACTION_EVENTS}`
}

export const USER_EVENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.USER_EVENTS}`
}

/**
 * Dashboard collections
 */
export const DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-transaction-stats-monthly`
}
export const DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-transaction-stats-daily`
}
export const DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-transaction-stats-hourly`
}
export const DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-rule-stats-hourly`
}

export const DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-hits-by-user-stats-hourly`
}
export const DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-consumer-user-stats-hourly`
}
export const DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_DAILY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-consumer-user-stats-daily`
}
export const DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_MONTHLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-business-users-stats-monthly`
}
export const DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-business-users-stats-hourly`
}
export const DASHBOARD_BUSINESS_USERS_STATS_COLLECTION_DAILY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-business-users-stats-daily`
}
export const DASHBOARD_CONSUMER_USERS_STATS_COLLECTION_MONTHLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-consumer-user-stats-monthly`
}

export const DASHBOARD_TEAM_CASES_STATS_HOURLY = (tenantId: string) => {
  return `${tenantId}-dashboard-team-cases-stats-hourly`
}
export const DASHBOARD_TEAM_ALERTS_STATS_HOURLY = (tenantId: string) => {
  return `${tenantId}-dashboard-team-alerts-stats-hourly`
}

export const DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY = (tenantId: string) => {
  return `${tenantId}-dashboard-latest-team-cases-stats-hourly`
}

export const DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY = (tenantId: string) => {
  return `${tenantId}-dashboard-latest-team-alerts-stats-hourly`
}

export const DASHBOARD_QA_ALERTS_BY_RULE_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-qa-alerts-by-rule-stats-hourly`
}

export const DASHBOARD_QA_ALERTS_BY_ASSIGNEE_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-qa-alerts-by-assignee-stats-hourly`
}

export const DASHBOARD_QA_OVERVIEW_STATS_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-qa-overview-stats-hourly`
}

export const DASHBOARD_QA_ALERTS_BY_CHECKLIST_REASON_COLLECTION_HOURLY = (
  tenantId: string
) => {
  return `${tenantId}-dashboard-qa-alerts-by-checklist-reason-stats-hourly`
}

export const DASHBOARD_SLA_TEAM_STATS_HOURLY = (tenantId: string) => {
  return `${tenantId}-dashboard-sla-team-stats-hourly`
}

export const REPORT_COLLECTION = (tenandId: string) => {
  return `${tenandId}-report`
}

export const JOBS_COLLECTION = (tenandId: string) => {
  return `${tenandId}-jobs`
}

// Pulse
export const KRS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.KRS_SCORE}`
}

export const ARS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.ARS_SCORE}`
}
export const DRS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.DRS_SCORE}`
}

export const IMPORT_COLLECTION = (tenantId: string) => {
  return `${tenantId}-import`
}

export const METADATA_COLLECTION = (tenantId: string) => {
  return `${tenantId}-metadata`
}

export const WEBHOOK_COLLECTION = (tenantId: string) => {
  return `${tenantId}-webhooks`
}

export const WEBHOOK_DELIVERY_COLLECTION = (tenantId: string) => {
  return `${tenantId}-webhook-deliveries`
}

export const WEBHOOK_RETRY_COLLECTION = (tenantId: string) => {
  return `${tenantId}-webhook-retries`
}

export const SANCTIONS_SEARCHES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-searches`
}

export const SANCTIONS_HITS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-hits`
}

export const SANCTIONS_WHITELIST_ENTITIES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-whitelist-entities`
}

export const SANCTIONS_SCREENING_DETAILS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-${MONGO_TABLE_SUFFIX_MAP.SANCTIONS_SCREENING_DETAILS}`
}

export const AUDITLOG_COLLECTION = (tenantId: string) => {
  return `${tenantId}-auditlog`
}

export const SIMULATION_TASK_COLLECTION = (tenantId: string) => {
  return `${tenantId}-simulation-task`
}

export const SIMULATION_RESULT_COLLECTION = (tenantId: string) => {
  return `${tenantId}-simulation-result`
}

export const MERCHANT_MONITORING_DATA_COLLECTION = (tenantId: string) => {
  return `${tenantId}-merchant-monitoring`
}

export const INVESTIGATION_COLLECTION = (tenantId: string) => {
  return `${tenantId}-investigation`
}

export const CHECKLIST_TEMPLATE_COLLECTION = (tenantId: string) => {
  return `${tenantId}-checklist-templates`
}

export const SLA_POLICIES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sla-policies`
}

export const RULE_QUEUES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-rule-queues`
}

export const REASONS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-reasons`
}

export const MIGRATION_TMP_COLLECTION = 'migration-tmp'
export const DELTA_SANCTIONS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-delta-sanctions`
}
export const SANCTIONS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions`
}
export const SANCTIONS_PROVIDER_SEARCHES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-provider-searches`
}
export const TRIAGE_QUEUE_TICKETS_COLLECTION = () => {
  return 'flagright-triage-queue-tickets'
}

/** Collection to log Requests and Responses to GPT */
export const GPT_REQUESTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-gpt-request-logs`
}

export const TRANSACTION_TYPE_DISTRIBUTION_STATS_COLLECTION = (
  tenantId: string
) => {
  return `${tenantId}-transaction-type-distribution`
}

export const NOTIFICATIONS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-notifications`
}

export const ML_MODELS_COLLECTION = () => {
  return `flagright-ml-models`
}

/** Rules Collection */
export const RULES_COLLECTION = FLAGRIGHT_TENANT_ID + '-rules'
/** DynamoDB Keys Collection */
export const DYNAMODB_PARTITIONKEYS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-dynamodb-partition-keys`
}

/** Tenant Deletion Collection */
export const TENANT_DELETION_COLLECTION =
  FLAGRIGHT_TENANT_ID + '-tenant-deletion'

export const UNIQUE_TAGS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-unique-tags`
}

export function getMongoDbIndexDefinitions(tenantId: string): {
  [collectionName: string]: {
    getIndexes: () => Array<{ index: { [key: string]: any }; unique?: boolean }>
    getSearchIndex?: () => Document
  }
} {
  return {
    [SANCTIONS_PROVIDER_SEARCHES_COLLECTION(tenantId)]: {
      getIndexes: () => {
        return [{ index: { providerSearchId: 1 } }]
      },
    },
    [UNIQUE_TAGS_COLLECTION(tenantId)]: {
      getIndexes: () => {
        return [
          { index: { tag: 1 } },
          { index: { type: 1 } },
          { index: { tag: 1, type: 1 }, unique: true },
        ]
      },
    },
    [TRANSACTIONS_COLLECTION(tenantId)]: {
      getIndexes: () => {
        const txnIndexes: Document[] = [
          'arsScore.arsScore',
          'arsScore.riskLevel',
          'caseStatus',
          'createdAt',
          'updatedAt',
          'destinationAmountDetails.country',
          'destinationAmountDetails.transactionAmount',
          'destinationAmountDetails.transactionCurrency',
          'destinationPaymentDetails.country',
          'destinationPaymentDetails.method',
          'originPaymentMethodId',
          'destinationPaymentMethodId',
          'destinationUserId',
          'executedRules.ruleHit',
          'executedRules.ruleId',
          'executedRules.ruleInstanceId',
          'hitRules.ruleAction',
          'hitRules.isShadow',
          'hitRules.ruleHitMeta.hitDirections',
          'originAmountDetails.country',
          'originAmountDetails.transactionAmount',
          'originAmountDetails.transactionCurrency',
          'originPaymentDetails.country',
          'originPaymentDetails.method',
          'originUserId',
          'status',
          'tags.key',
          'transactionState',
          'type',
          'hitRules.ruleInstanceId',
        ].flatMap((i) => {
          return [{ [i]: 1, timestamp: 1, _id: 1 }]
        })

        txnIndexes.push(
          {
            destinationUserId: 1,
            'executedRules.ruleInstanceId': 1,
            timestamp: 1,
            _id: 1,
          },
          {
            originUserId: 1,
            'executedRules.ruleInstanceId': 1,
            timestamp: 1,
            _id: 1,
          },
          { originUserId: 1, timestamp: -1, _id: -1 },
          { destinationUserId: 1, timestamp: -1, _id: -1 },
          { arsScore: 1 },
          { alertIds: 1, timestamp: -1, _id: -1 },
          { timestamp: 1, _id: 1 }
        )

        // NOTE: These indexes are for running the rules in the Simulation mode
        for (const fields of Object.values(PAYMENT_METHOD_IDENTIFIER_FIELDS)) {
          txnIndexes.push({
            'originPaymentDetails.method': 1,
            ...Object.fromEntries(
              fields.map((field) => [`originPaymentDetails.${field}`, 1])
            ),
          })
          txnIndexes.push({
            'destinationPaymentDetails.method': 1,
            ...Object.fromEntries(
              fields.map((field) => [`destinationPaymentDetails.${field}`, 1])
            ),
          })
        }

        const uniqueTransactionIdIndex = {
          index: { transactionId: 1 },
          unique: true,
        }

        return txnIndexes
          .map((index) => ({ index }))
          .concat(uniqueTransactionIdIndex)
      },
    },
    [USERS_COLLECTION(tenantId)]: {
      getIndexes: () => {
        const indexes1: Array<{ index: { [key: string]: any } }> = [
          { type: 1 },
          { isMonitoringEnabled: 1 },
          { 'userDetails.name.firstName': 1 },
          { 'userDetails.name.middleName': 1 },
          { 'userDetails.name.lastName': 1 },
          { 'legalEntity.companyGeneralDetails.legalName': 1 },
          { 'legalEntity.companyGeneralDetails.businessIndustry': 1 },
          ...['', 'legalEntity.', 'directors.', 'shareHolders.'].flatMap(
            (prefix) => [
              { [`${prefix}contactDetails.emailIds`]: 1 },
              { [`${prefix}contactDetails.contactNumbers`]: 1 },
              {
                [`${prefix}contactDetails.addresses.postcode`]: 1,
                [`${prefix}contactDetails.addresses.addressLines`]: 1,
              },
            ]
          ),
          { 'linkedEntities.parentUserId': 1 },
          { 'legalDocuments.documentNumber': 1 },
        ].map((index) => ({
          index: { ...index, createdTimestamp: -1, _id: 1 },
        }))

        const indexes2 = [
          { createdTimestamp: 1 },
          { updatedAt: 1 },
          { createdAt: 1 },
        ].map((index) => ({
          index: { ...index, _id: 1 },
        }))

        const uniqueUserIdIndex = { index: { userId: 1 }, unique: true }

        const indexes3 = [
          { lastTransactionTimestamp: 1 },
          { userId: 1, createdTimestamp: 1 },
          { 'userDetails.name.firstName': 1, createdTimestamp: 1 },
          { 'userDetails.name.middleName': 1, createdTimestamp: 1 },
          { 'userDetails.name.lastName': 1, createdTimestamp: 1 },
          {
            'legalEntity.companyGeneralDetails.legalName': 1,
            createdTimestamp: 1,
          },
          { createdTimestamp: 1 },
        ].map((index) => ({ index }))

        return [...indexes1, ...indexes2, uniqueUserIdIndex, ...indexes3]
      },
      getSearchIndex:
        tenantId === 'pnb'
          ? () => ({
              mappings: {
                dynamic: false,
                fields: {
                  userDetails: {
                    type: 'document',
                    fields: {
                      name: {
                        type: 'document',
                        fields: {
                          firstName: {
                            type: 'string',
                          },
                          middleName: {
                            type: 'string',
                          },
                          lastName: {
                            type: 'string',
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
          : undefined,
    },
    [USER_EVENTS_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          {
            eventId: 1,
          },
          {
            createdAt: 1,
          },
          {
            userId: 1,
            timestamp: -1,
          },
        ].map((index) => ({ index })),
    },
    [TRANSACTION_EVENTS_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          {
            transactionId: 1,
            timestamp: -1,
          },
          {
            transactionId: 1,
            transactionState: 1,
            timestamp: -1,
          },
          {
            eventId: 1,
          },
          {
            createdAt: 1,
          },
        ].map((index) => ({ index })),
    },
    [CASES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { availableAfterTimestamp: 1 },
          { caseId: 1 },
          { createdTimestamp: -1, _id: 1 },
          { caseStatus: 1, createdTimestamp: 1 },
          { 'caseUsers.origin.userId': 1 },
          { 'caseUsers.destination.userId': 1 },
          {
            'caseUsers.destination.legalEntity.companyGeneralDetails.businessIndustry': 1,
          },
          {
            'caseUsers.origin.legalEntity.companyGeneralDetails.businessIndustry': 1,
          },
          { 'caseUsers.originUserDrsScore': 1 },
          { 'caseUsers.destinationUserDrsScore': 1 },
          { 'assignments.assigneeUserId': 1 },
          { 'assignments.timestamp': 1 },
          { 'statusChanges.timestamp': 1 },
          { 'statusChanges.caseStatus': 1 },
          { 'alerts.statusChanges.timestamp': 1 },
          { 'alerts.statusChanges.caseStatus': 1 },
          { updatedAt: 1 },
          { 'alerts._id': 1 },
          { 'alerts.updatedAt': 1 },
          { 'alerts.alertId': 1 },
          { 'alerts.ruleInstanceId': 1 },
          { 'alerts.ruleQueueId': 1 },
          { 'alerts.alertStatus': 1 },
          { 'alerts.assignments.assigneeUserId': 1 },
          { 'alerts.assignments.timestamp': 1 },
          { 'alerts.priority': 1 },
          { 'alerts.createdTimestamp': 1 },
          { 'alerts.numberOfTransactionsHit': 1 },
          { 'caseAggregates.originPaymentMethods': 1 },
          { 'caseAggregates.destinationPaymentMethods': 1 },
          { 'caseAggregates.tags.key': 1, 'caseAggregates.tags.value': 1 },
          { caseType: 1, caseStatus: 1 },
          { caseTransactionsIds: 1 },
          {
            availableAfterTimestamp: 1,
            numberOfTransactionsHit: 1,
            _id: 1,
            caseStatus: 1,
            createdTimestamp: 1,
          },
          {
            availableAfterTimestamp: 1,
            caseId: 1,
            _id: 1,
            createdTimestamp: 1,
          },
        ].map((index) => ({ index })),
    },
    [AUDITLOG_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { auditlogId: 1 },
          { timestamp: -1 },
          { type: 1, action: 1 },
          { entityId: 1, timestamp: -1 },
          { entityId: 1 },
        ].map((index) => ({ index })),
    },
    [SIMULATION_TASK_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ type: 1, createdAt: -1 }].map((index) => ({ index })),
    },
    [SIMULATION_RESULT_COLLECTION(tenantId)]: {
      getIndexes: () => [{ taskId: 1 }].map((index) => ({ index })),
    },
    [KRS_SCORES_COLLECTION(tenantId)]: {
      getIndexes: () => [{ userId: 1 }].map((index) => ({ index })),
    },
    [ARS_SCORES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { transactionId: 1 },
          { originUserId: 1 },
          { destinationUserId: 1 },
        ].map((index) => ({ index })),
    },
    [DRS_SCORES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ userId: 1 }, { userId: 1, createdAt: -1 }].map((index) => ({
          index,
        })),
    },
    [WEBHOOK_COLLECTION(tenantId)]: {
      getIndexes: () => [{ events: 1 }].map((index) => ({ index })),
    },
    [WEBHOOK_DELIVERY_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { webhookId: 1, requestStartedAt: -1 },
          { deliveryTaskId: 1, deliveredAt: 1 },
          { eventCreatedAt: 1 },
          { deliveredAt: 1 },
          { success: 1 },
          { webhookId: 1 },
          { webhookId: 1, success: 1 },
          { webhookId: 1, eventCreatedAt: 1 },
          { webhookId: 1, deliveredAt: 1 },
          { entityId: 1 },
        ].map((index) => ({ index })),
    },
    [SANCTIONS_SEARCHES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { createdAt: 1, _id: 1 },
          { provider: 1, _id: 1 },
          { 'request.searchTerm': 1 },
          { 'response.data.types': 1 },
          { 'response.providerSearchId': 1 },
          { requestHash: 1 },
        ].map((index) => ({ index })),
    },
    [SANCTIONS_HITS_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { searchId: 1, sanctionsHitId: 1 },
          { sanctionsHitId: 1 },
          { createdAt: 1, sanctionsHitId: 1 },
        ].map((index) => ({
          index,
        })),
    },
    [SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenantId)]: {
      getIndexes: () => [
        { index: { sanctionsWhitelistId: -1 }, unique: true },
        { index: { 'caEntity.id': 1, userId: 1 } },
        { index: { userId: 1 } },
        { index: { entity: 1 } },
        { index: { entityType: 1 } },
      ],
    },
    [SANCTIONS_SCREENING_DETAILS_COLLECTION(tenantId)]: {
      getIndexes: () => [
        ...[
          { lastScreenedAt: 1 },
          { name: 1, lastScreenedAt: 1 },
          { entity: 1, lastScreenedAt: 1 },
          { ruleInstanceIds: 1, userId: 1 },
          { ruleInstanceIds: 1, transactionId: 1 },
        ].map((index) => ({ index })),
        ...[{ index: { name: 1, entity: 1, lastScreenedAt: 1 }, unique: true }],
      ],
    },
    [DELTA_SANCTIONS_COLLECTION(tenantId)]: {
      getIndexes: () => [
        {
          index: {
            provider: 1,
            version: 1,
            id: 1,
            deletedAt: 1,
          },
        },
        {
          index: {
            provider: 1,
            version: 1,
            id: 1,
          },
          unique: true,
        },
        {
          index: {
            'documents.formattedId': 1,
          },
        },
        {
          index: {
            'documents.id': 1,
          },
        },
        {
          index: {
            nationality: 1,
          },
        },
        {
          index: {
            gender: 1,
          },
        },
        {
          index: {
            'occupations.rank': 1,
          },
        },
        {
          index: {
            'associates.ranks': 1,
          },
        },
        {
          index: {
            yearOfBirth: 1,
          },
        },
        { index: { version: 1 } },
        { index: { updatedAt: -1 } },
      ],
      getSearchIndex: () => SANCTIONS_SEARCH_INDEX_DEFINITION,
    },
    [NARRATIVE_TEMPLATE_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ id: 1 }, { name: 1 }, { description: 1 }, { createdAt: 1 }].map(
          (index) => ({ index })
        ),
    },
    [SLA_POLICIES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ id: 1 }, { name: 1 }, { createdAt: 1 }].map((index) => ({ index })),
    },
    [METRICS_COLLECTION(tenantId)]: {
      getIndexes: () => [{ name: 1, date: 1 }].map((index) => ({ index })),
    },
    [CRM_SUMMARY_COLLECTION(tenantId)]: {
      getIndexes: () => [{ account: 1 }].map((index) => ({ index })),
    },
    [CRM_NOTES_COLLECTION(tenantId)]: {
      getIndexes: () => [{ account: 1 }].map((index) => ({ index })),
    },
    [CRM_ENGAGEMENTS_COLLECTION(tenantId)]: {
      getIndexes: () => [{ account: 1 }].map((index) => ({ index })),
    },
    [CRM_TASKS_COLLECTION(tenantId)]: {
      getIndexes: () => [{ account: 1 }].map((index) => ({ index })),
    },
    [CHECKLIST_TEMPLATE_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ id: 1 }, { createdAt: 1 }].map((index) => ({ index })),
    },
    [RULE_QUEUES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          {
            id: 1,
            name: 1,
            description: 1,
            defaultNature: 1,
            typologies: 1,
            types: 1,
          },
          { id: 1 },
          { name: 1 },
          { description: 1 },
          { typologies: 1 },
          { defaultNature: 1 },
          { types: 1 },
        ].map((index) => ({ index })),
    },
    [API_REQUEST_LOGS_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          {
            path: 1,
            timestamp: 1,
          },
          {
            requestId: 1,
          },
          {
            traceId: 1,
          },
        ].map((index) => ({ index })),
    },
    [REPORT_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          {
            createdAt: 1,
          },
        ].map((index) => ({ index })),
    },
    [ALERTS_QA_SAMPLING_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          {
            samplingId: 1,
          },
          {
            createdAt: 1,
          },
        ].map((index) => ({ index })),
    },
    [COUNTER_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          {
            entity: 1,
          },
        ].map((index) => ({ index })),
    },
    [JOBS_COLLECTION(tenantId)]: {
      getIndexes: () => [
        { index: { jobId: 1 }, unique: true },
        { index: { type: 1, 'latestStatus.timestamp': 1 } },
        { index: { type: 1, 'latestStatus.status': 1 } },
        { index: { 'latestStatus.timestamp': 1 } },
      ],
    },
    [SANCTIONS_COLLECTION(tenantId)]: {
      getIndexes: () => [
        {
          index: {
            provider: 1,
            version: 1,
            id: 1,
            deletedAt: 1,
          },
        },
        {
          index: {
            provider: 1,
            version: 1,
            id: 1,
          },
          unique: true,
        },
        {
          index: {
            'documents.formattedId': 1,
          },
        },
        {
          index: {
            'documents.id': 1,
          },
        },
        {
          index: {
            nationality: 1,
          },
        },
        {
          index: {
            gender: 1,
          },
        },
        {
          index: {
            'occupations.rank': 1,
          },
        },
        {
          index: {
            'associates.ranks': 1,
          },
        },
        {
          index: {
            yearOfBirth: 1,
          },
        },
        { index: { version: 1 } },
        { index: { updatedAt: -1 } },
      ],
      getSearchIndex: () => SANCTIONS_SEARCH_INDEX_DEFINITION,
    },
  }
}

export const getGlobalCollectionIndexes = (): {
  [collectionName: string]: {
    getIndexes: () => Array<{ index: { [key: string]: any }; unique?: boolean }>
    getSearchIndex?: () => Document
  }
} => {
  return {}
}

export const getSearchIndexName = (collectionName: string) => {
  return `${collectionName}_search_index`
}
