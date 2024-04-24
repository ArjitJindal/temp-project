import { Document } from 'mongodb'
import { PAYMENT_METHOD_IDENTIFIER_FIELDS } from '@/core/dynamodb/dynamodb-keys'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'

export const TRANSACTIONS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-transactions`
}

export const API_REQUEST_LOGS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-api-request-logs`
}

export const NARRATIVE_TEMPLATE_COLLECTION = (tenantId: string) => {
  return `${tenantId}-narrative-templates`
}

export const CASES_COLLECTION = (tenandId: string) => {
  return `${tenandId}-cases`
}

export const METRICS_COLLECTION = (tenandId: string) => {
  return `${tenandId}-metrics`
}

export const COUNTER_COLLECTION = (tenantId: string) => {
  return `${tenantId}-counter`
}

export const ALERTS_QA_SAMPLING_COLLECTION = (tenantId: string) => {
  return `${tenantId}-alerts-qa-sampling`
}

export const CRM_ENGAGEMENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-crm-engagements`
}
export const CRM_NOTES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-crm-notes`
}

export const CRM_TASKS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-crm-tasks`
}

export const CRM_SUMMARY_COLLECTION = (tenantId: string) => {
  return `${tenantId}-crm-summary`
}

export const USERS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-users`
}

export const ACCOUNTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-accounts`
}

export const TRANSACTION_EVENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-transaction-events`
}

export const USER_EVENTS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-user-events`
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

export const REPORT_COLLECTION = (tenandId: string) => {
  return `${tenandId}-report`
}

// Pulse
export const KRS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-kyc-risk-values`
}
export const ARS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-action-risk-values`
}
export const DRS_SCORES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-dynamic-risk-values`
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

export const SANCTIONS_SEARCHES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-searches`
}

export const SANCTIONS_WHITELIST_ENTITIES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-whitelist-entities`
}

export const SANCTIONS_SCREENING_DETAILS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-sanctions-screening-details`
}

export const IBAN_COLLECTION = (tenantId: string) => {
  return `${tenantId}-iban`
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

export const RULE_QUEUES_COLLECTION = (tenantId: string) => {
  return `${tenantId}-rule-queues`
}

export const MIGRATION_TMP_COLLECTION = 'migration-tmp'

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

/** Rules Collection */
export const RULES_COLLECTION = FLAGRIGHT_TENANT_ID + '-rules'
/** DynamoDB Keys Collection */
export const DYNAMODB_PARTITIONKEYS_COLLECTION = (tenantId: string) => {
  return `${tenantId}-dynamodb-partition-keys`
}

/** Tenant Deletion Collection */
export const TENANT_DELETION_COLLECTION =
  FLAGRIGHT_TENANT_ID + '-tenant-deletion'

export function getMongoDbIndexDefinitions(tenantId: string): {
  [collectionName: string]: {
    getIndexes: () => Array<{ index: { [key: string]: any }; unique?: boolean }>
  }
} {
  return {
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
          'hitRules.ruleInstanceId',
          'originAmountDetails.country',
          'originAmountDetails.transactionAmount',
          'originAmountDetails.transactionCurrency',
          'originPaymentDetails.country',
          'originPaymentDetails.method',
          'originUserId',
          'status',
          'tags.key',
          'timestamp',
          'transactionId',
          'transactionState',
          'type',
        ].flatMap((i) => {
          return [{ [i]: 1, _id: 1 }]
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
          { transactionId: 1, timestamp: 1 },
          { originUserId: 1, timestamp: 1, _id: 1 },
          { destinationUserId: 1, timestamp: 1, _id: 1 },
          { originUserId: 1, timestamp: -1, _id: -1 },
          { destinationUserId: 1, timestamp: -1, _id: -1 },
          { arsScore: 1 }
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
        return txnIndexes.map((index) => ({ index }))
      },
    },
    [USERS_COLLECTION(tenantId)]: {
      getIndexes: () => {
        return [
          { type: 1 },
          { createdTimestamp: 1 },
          { updatedAt: 1 },
          { createdAt: 1 },
          { userId: 1 },
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
        ].map((index) => ({ index: { ...index, _id: 1 } }))
      },
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
          { caseTransactionsIds: 1 },
        ].map((index) => ({ index })),
    },
    [AUDITLOG_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { auditlogId: 1 },
          { timestamp: -1 },
          { type: 1, action: 1 },
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
    [ACCOUNTS_COLLECTION(tenantId)]: {
      getIndexes: () => [{ index: { id: 1 }, unique: true }],
    },

    [KRS_SCORES_COLLECTION(tenantId)]: {
      getIndexes: () => [{ userId: 1 }].map((index) => ({ index })),
    },
    [ARS_SCORES_COLLECTION(tenantId)]: {
      getIndexes: () => [{ transactionId: 1 }].map((index) => ({ index })),
    },
    [DRS_SCORES_COLLECTION(tenantId)]: {
      getIndexes: () => [{ userId: 1 }].map((index) => ({ index })),
    },
    [WEBHOOK_COLLECTION(tenantId)]: {
      getIndexes: () => [{ events: 1 }].map((index) => ({ index })),
    },
    [WEBHOOK_DELIVERY_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { webhookId: 1, requestStartedAt: -1 },
          { deliveryTaskId: 1, deliveredAt: 1 },
        ].map((index) => ({ index })),
    },
    [SANCTIONS_SEARCHES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [
          { createdAt: 1, _id: 1 },
          { 'response.rawComplyAdvantageResponse.content.data.id': 1 },
          { 'request.searchTerm': 1 },
          { 'response.data.doc.types': 1 },
        ].map((index) => ({ index })),
    },
    [IBAN_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ 'request.iban': 1, createdAt: 1 }].map((index) => ({ index })),
    },
    [SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ 'caEntity.id': 1, userId: 1 }].map((index) => ({ index })),
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
    [NARRATIVE_TEMPLATE_COLLECTION(tenantId)]: {
      getIndexes: () =>
        [{ id: 1 }, { name: 1 }, { description: 1 }, { createdAt: 1 }].map(
          (index) => ({ index })
        ),
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
  }
}
