import { ClickhouseTableMaterializedViews } from './views'
import { CLICKHOUSE_ID_COLUMN_MAP } from './id-column-map'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'

export const CLICKHOUSE_DEFINITIONS = {
  TRANSACTIONS_FROM_MODEL: {
    tableName: ClickhouseTableNames.TransactionsFromModel,
    definition: {
      idColumn:
        CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.TransactionsFromModel],
      timestampColumn: 'timestamp',
    },
  },
  TRANSACTIONS: {
    tableName: ClickhouseTableNames.Transactions,
    definition: {
      idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Transactions],
      timestampColumn: 'timestamp',
    },
    materializedViews: {
      BY_ID: {
        viewName: ClickhouseTableMaterializedViews.TransactionsById,
        table: ClickhouseTableNames.TransactionsByid,
      },
      BY_TYPE: {
        viewName: ClickhouseTableMaterializedViews.TransactionsByType,
        table: ClickhouseTableNames.TransactionsByType,
      },
      BY_TYPE_DAILY: {
        viewName: ClickhouseTableMaterializedViews.TransactionsByTypeDaily,
        table: ClickhouseTableNames.TransactionsByTypeDaily,
      },
    },
  },
  TRANSACTIONS_DESC: {
    tableName: ClickhouseTableNames.TransactionsDesc,
    definition: {
      idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.TransactionsDesc],
      timestampColumn: 'timestamp',
    },
  },
  USERS: {
    tableName: ClickhouseTableNames.Users,
    definition: {
      idColumn: CLICKHOUSE_ID_COLUMN_MAP[ClickhouseTableNames.Users],
      timestampColumn: 'createdTimestamp',
    },
    materializedViews: {
      BY_ID: {
        viewName: ClickhouseTableMaterializedViews.UsersById,
        table: ClickhouseTableNames.UsersById,
      },
    },
  },
  TRANSACTION_EVENTS: {
    tableName: ClickhouseTableNames.TransactionEvents,
  },
  USER_EVENTS: {
    tableName: ClickhouseTableNames.UserEvents,
  },
  CASES: {
    tableName: ClickhouseTableNames.Cases,
  },
  REPORTS: {
    tableName: ClickhouseTableNames.Reports,
  },
  KRS_SCORE: {
    tableName: ClickhouseTableNames.KrsScore,
  },
  DRS_SCORE: {
    tableName: ClickhouseTableNames.DrsScore,
  },
  ARS_SCORE: {
    tableName: ClickhouseTableNames.ArsScore,
  },
  SANCTIONS_SCREENING_DETAILS: {
    tableName: ClickhouseTableNames.SanctionsScreeningDetails,
    materializedViews: {
      BY_ID: {
        viewName:
          ClickhouseTableMaterializedViews.SanctionsScreeningDetailsById,
        table: ClickhouseTableNames.SanctionsScreeningDetailsById,
      },
    },
  },
  SANCTIONS_SCREENING_DETAILS_V2: {
    tableName: ClickhouseTableNames.SanctionsScreeningDetailsV2,
    materializedViews: {
      BY_ID: {
        viewName:
          ClickhouseTableMaterializedViews.SanctionsScreeningDetailsV2ById,
        table: ClickhouseTableNames.SanctionsScreeningDetailsV2ById,
      },
    },
  },
  ALERTS: {
    tableName: ClickhouseTableNames.Alerts,
  },
  CRM_RECORDS: {
    tableName: ClickhouseTableNames.CrmRecords,
  },
  CRM_USER_RECORD_LINK: {
    tableName: ClickhouseTableNames.CrmUserRecordLink,
  },
  CASES_V2: {
    tableName: ClickhouseTableNames.CasesV2,
  },
  DYNAMIC_PERMISSIONS_ITEMS: {
    tableName: ClickhouseTableNames.DynamicPermissionsItems,
  },
  AUDIT_LOGS: {
    tableName: ClickhouseTableNames.AuditLogs,
  },
  ALERTS_QA_SAMPLING: {
    tableName: ClickhouseTableNames.AlertsQaSampling,
  },
  API_REQUEST_LOGS: {
    tableName: ClickhouseTableNames.ApiRequestLogs,
  },
  NOTIFICATIONS: {
    tableName: ClickhouseTableNames.Notifications,
  },
  GPT_REQUESTS: {
    tableName: ClickhouseTableNames.GptRequests,
  },
  METRICS: {
    tableName: ClickhouseTableNames.Metrics,
  },
  WEBHOOK: {
    tableName: ClickhouseTableNames.Webhook,
  },
  WEBHOOK_DELIVERIES: {
    tableName: ClickhouseTableNames.WebhookDelivery,
  },
  CLOUDWATCH_LOGS: {
    tableName: ClickhouseTableNames.CloudwatchLogs,
    database: 'default',
  },
  CLOUDWATCH_LOGS_CORRELATED: {
    tableName: ClickhouseTableNames.CloudwatchLogsCorrelated,
    database: 'default',
  },
} as const
