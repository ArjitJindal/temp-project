import { Document, MongoClient } from 'mongodb'
import {
  SANCTIONS_PROVIDER_SEARCHES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  USER_EVENTS_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  CASES_COLLECTION,
  AUDITLOG_COLLECTION,
  SIMULATION_TASK_COLLECTION,
  SIMULATION_RESULT_COLLECTION,
  KRS_SCORES_COLLECTION,
  ARS_SCORES_COLLECTION,
  DRS_SCORES_COLLECTION,
  WEBHOOK_COLLECTION,
  WEBHOOK_DELIVERY_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
  SANCTIONS_SCREENING_DETAILS_COLLECTION,
  SANCTIONS_SCREENING_DETAILS_V2_COLLECTION,
  DELTA_SANCTIONS_COLLECTION,
  NARRATIVE_TEMPLATE_COLLECTION,
  SLA_POLICIES_COLLECTION,
  METRICS_COLLECTION,
  CRM_SUMMARY_COLLECTION,
  CRM_NOTES_COLLECTION,
  CRM_ENGAGEMENTS_COLLECTION,
  CRM_TASKS_COLLECTION,
  CHECKLIST_TEMPLATE_COLLECTION,
  RULE_QUEUES_COLLECTION,
  API_REQUEST_LOGS_COLLECTION,
  REPORT_COLLECTION,
  ALERTS_QA_SAMPLING_COLLECTION,
  COUNTER_COLLECTION,
  SANCTIONS_SOURCE_DOCUMENTS_COLLECTION,
  JOBS_COLLECTION,
  SANCTIONS_COLLECTION,
  SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION,
  UNIQUE_TAGS_COLLECTION,
} from './mongo-table-names'
import {
  getAllGlobalSanctionsCollectionDefinition,
  shouldBuildSearchIndexForUsers,
} from '@/services/sanctions/utils'

export const SANCTIONS_SEARCH_INDEX_DEFINITION = (
  isDelta?: boolean
): Document => ({
  mappings: {
    dynamic: false,
    fields: {
      normalizedAka: {
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
      isActivePep: {
        type: 'boolean',
      },
      isActiveSanctioned: {
        type: 'boolean',
      },
      ...(isDelta
        ? {
            provider: {
              type: 'string',
            },
          }
        : {}),
    },
  },
})

export const SANCTIONS_INDEX_DEFINITION: Array<{
  index: { [key: string]: any }
  unique?: boolean
}> = [
  {
    index: {
      provider: 1,
      version: 1,
      id: 1,
      entityType: 1,
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
  {
    index: {
      normalizedAka: 1,
    },
  },
]

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
          { index: { tag: 1, type: 1, value: 1 }, unique: true },
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
          { originUserId: 1, timestamp: -1, _id: -1 },
          { destinationUserId: 1, timestamp: -1, _id: -1 },
          { alertIds: 1, timestamp: -1, _id: -1 },
          { timestamp: 1, _id: 1 }
        )

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
          { 'linkedEntities.parentUserId': 1 },
          { 'kycStatusDetails.status': 1 },
          { createdTimestamp: 1 },
        ].map((index) => ({ index }))

        return [...indexes1, ...indexes2, uniqueUserIdIndex, ...indexes3]
      },
      getSearchIndex: shouldBuildSearchIndexForUsers()
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
                legalEntity: {
                  type: 'document',
                  fields: {
                    companyGeneralDetails: {
                      type: 'document',
                      fields: {
                        legalName: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
                shareHolders: {
                  type: 'document',
                  fields: {
                    generalDetails: {
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
                directors: {
                  type: 'document',
                  fields: {
                    generalDetails: {
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
          { type: 1, action: 1, subtype: 1 },
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
      getIndexes: () => {
        return [
          { index: { transactionId: 1 }, unique: true },
          { index: { originUserId: 1 } },
          { index: { destinationUserId: 1 } },
        ]
      },
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
          { searchedBy: 1 },
          { 'request.monitoring.enabled': 1, expiresAt: 1, requestHash: 1 },
          { 'request.monitoring.enabled': 1, requestHash: 1 },
          { 'request.fuzzinessRange': 1 },
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
    [SANCTIONS_SCREENING_DETAILS_V2_COLLECTION(tenantId)]: {
      getIndexes: () => [
        { index: { screeningId: 1 }, unique: true },
        { index: { referenceCounter: 1 } },
        {
          index: { userId: 1, lastScreenedAt: 1 },
          partialFilterExpression: { userId: { $exists: true } },
        },
        {
          index: { transactionId: 1, lastScreenedAt: 1 },
          partialFilterExpression: { transactionId: { $exists: true } },
        },
      ],
    },
    [DELTA_SANCTIONS_COLLECTION(tenantId)]: {
      getIndexes: () => SANCTIONS_INDEX_DEFINITION,
      getSearchIndex: () => SANCTIONS_SEARCH_INDEX_DEFINITION(true),
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
    [SANCTIONS_SOURCE_DOCUMENTS_COLLECTION(tenantId)]: {
      getIndexes: () => [
        { index: { sourceCountry: 1 } },
        { index: { sourceName: 1 } },
        { index: { id: 1 } },
        {
          index: {
            sourceName: 1,
            sourceCountry: 1,
            provider: 1,
            entityType: 1,
            sourceType: 1,
          },
          unique: true,
        },
        { index: { refId: 1 } },
      ],
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
      getIndexes: () => SANCTIONS_INDEX_DEFINITION,
      getSearchIndex: () => SANCTIONS_SEARCH_INDEX_DEFINITION(false),
    },
  }
}

export const getGlobalCollectionIndexes = async (
  mongoClient: MongoClient
): Promise<{
  [collectionName: string]: {
    getIndexes: () => Array<{ index: { [key: string]: any }; unique?: boolean }>
    getSearchIndex?: () => Document
  }
}> => {
  const globalSanctionsCollectionDeinitions =
    await getAllGlobalSanctionsCollectionDefinition(mongoClient)
  return {
    ...globalSanctionsCollectionDeinitions,
    [SANCTIONS_SOURCE_DOCUMENTS_GLOBAL_COLLECTION()]: {
      getIndexes: () => [
        { index: { sourceCountry: 1 } },
        { index: { sourceName: 1 } },
        { index: { id: 1 } },
        {
          index: {
            sourceName: 1,
            sourceCountry: 1,
            provider: 1,
            entityType: 1,
            sourceType: 1,
          },
          unique: true,
        },
        { index: { refId: 1 } },
      ],
    },
  }
}

export const getSearchIndexName = (collectionName: string) => {
  return `${collectionName}_search_index`
}
