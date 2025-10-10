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
      TRANSACTION_MONTHLY_STATS: {
        viewName: ClickhouseTableMaterializedViews.TransactionsMonthlyStats,
        table: ClickhouseTableNames.TransactionsMonthlyStats,
      },
      TRANSACTION_HOURLY_STATS: {
        viewName: ClickhouseTableMaterializedViews.TransactionsHourlyStats,
        table: ClickhouseTableNames.TransactionsHourlyStats,
      },
      TRANSACTION_DAILY_STATS: {
        viewName: ClickhouseTableMaterializedViews.TransactionsDailyStats,
        table: ClickhouseTableNames.TransactionsDailyStats,
      },
      RULE_STATS_HOURLY: {
        viewName: ClickhouseTableMaterializedViews.RuleStatsHourlyTransactions,
        table: ClickhouseTableNames.RuleStatsHourlyTransactions,
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
      USER_MONTHLY_STATS: {
        viewName: ClickhouseTableMaterializedViews.UserMonthlyStats,
        table: ClickhouseTableNames.UserMonthlyStats,
      },
      USER_HOURLY_STATS: {
        viewName: ClickhouseTableMaterializedViews.UserHourlyStats,
        table: ClickhouseTableNames.UserHourlyStats,
      },
      USER_DAILY_STATS: {
        viewName: ClickhouseTableMaterializedViews.UserDailyStats,
        table: ClickhouseTableNames.UserDailyStats,
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
    materializedViews: {
      INVESTIGATION_TIMES_HOURLY_STATS: {
        viewName:
          ClickhouseTableMaterializedViews.CasesInvestigationTimesHourly,
        table: ClickhouseTableNames.CasesInvestigationTimesHourly,
      },
    },
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
} as const
