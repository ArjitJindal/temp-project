import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
  CASES_COLLECTION,
  TRANSACTION_EVENTS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongo-table-names'

export const metricsConfig = (tenantId: string) => [
  {
    metric: 'transactions_count',
    collection: TRANSACTIONS_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName,
    unwind: false,
  },
  {
    metric: 'users_count',
    collection: USERS_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.USERS.tableName,
    unwind: false,
  },
  {
    metric: 'cases_count',
    collection: CASES_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.CASES.tableName,
    unwind: false,
  },
  {
    metric: 'alerts_count',
    collection: CASES_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.CASES.tableName,
    unwind: true,
    unwindField: 'alerts',
  },
  {
    metric: 'cases_v2_count',
    collection: CASES_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.CASES_V2.tableName,
    unwind: false,
  },
  {
    metric: 'cases_v2_alerts_count',
    collection: CASES_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.ALERTS.tableName,
    unwind: false,
  },
  {
    metric: 'transaction_events_count',
    collection: TRANSACTION_EVENTS_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName,
    unwind: false,
  },
  {
    metric: 'user_events_count',
    collection: USER_EVENTS_COLLECTION(tenantId),
    table: CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName,
    unwind: false,
  },
]
