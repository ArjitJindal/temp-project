import { RangeValue } from 'rc-picker/es/interface';
import { QueryKey } from '@tanstack/react-query';
import { Dayjs } from '@/utils/dayjs';
import { ListType, MerchantMonitoringSource } from '@/apis';
import { TransactionsUniquesField } from '@/apis/models/TransactionsUniquesField';
import { UsersUniquesField } from '@/apis/models/UsersUniquesField';

type AnyParameters = unknown;

export const CASES_LIST = (params: AnyParameters): QueryKey => ['cases', 'list', { params }];
export const CASES_ITEM = (caseId: string): QueryKey => ['cases', caseId];
export const CASES_ITEM_ALERT_LIST = (caseId: string, params?: AnyParameters): QueryKey =>
  ['cases', caseId, 'alerts', 'list', params].filter(Boolean);
export const CASES_ITEM_RULES = (caseId: string): QueryKey => ['cases', caseId, 'rules'];
export const CASES_USERS_CASEIDS = (params: AnyParameters): QueryKey => [
  'cases',
  'users',
  'caseIds',
  params,
];

export const CASES_RULE_TRANSACTIONS = (
  caseId: string,
  params: AnyParameters,
  ruleInstanceId: string,
): QueryKey => ['cases', caseId, 'transactions', 'list', ruleInstanceId, params];
export const CASES_ITEM_TRANSACTIONS = (caseId: string, searchParams: AnyParameters): QueryKey => [
  'cases',
  caseId,
  'transactions',
  'list',
  searchParams,
];
export const LISTS_OF_TYPE = (type: ListType): QueryKey => ['lists', { type }, 'list'];
export const LISTS_ITEM = (id?: string): QueryKey => ['lists', 'item', id];
export const LISTS_ITEM_TYPE = (id: string, type: ListType): QueryKey => [
  'lists',
  'item',
  id,
  type,
];
export const LISTS = (): QueryKey => ['lists'];
export const USERS_ITEM_TRANSACTIONS_HISTORY = (
  userId: string,
  params: AnyParameters,
): QueryKey => ['users', userId, 'transactions-history', params];
export const USERS_FIND = (search: string): QueryKey => ['users', 'list', 'search', search];
export const TRANSACTIONS_FIND = (search: string): QueryKey => [
  'transactions',
  'list',
  'search',
  search,
];
export const ACCOUNT_LIST = (): QueryKey => ['accounts', 'list'];
export const ACCOUNT_LIST_TEAM_MANAGEMENT = (): QueryKey => ['accounts', 'list-team-management'];
export const USER_INFO = (accessToken: string | null): QueryKey => ['userinfo', accessToken];
export const CRM_ACCOUNT = (userId: string): QueryKey => ['crmaccount', userId];

export const USER_ENTITY = (userId: string): QueryKey => ['userentity', userId];
export const ROLES_LIST = (): QueryKey => ['roles', 'list'];
export const ROLE = (roleId: string): QueryKey => ['role', roleId];

export const REPORT_SCHEMAS = (): QueryKey => ['report', 'schemas'];
export const REPORT_TEMPLATE = (caseId: string, schemaId: string): QueryKey => [
  'report',
  'template',
  caseId,
  schemaId,
];
export const TRANSACTIONS_LIST = (searchParams: AnyParameters): QueryKey => [
  'transactions',
  'list',
  searchParams,
];

export const REPORTS_ITEM = (id: string): QueryKey => ['reports', 'item', id];
export const REPORTS_LIST = (params: AnyParameters): QueryKey => ['reports', 'list', params];
export const TRANSACTIONS_ITEM_RISKS_ARS = (transactionId: string): QueryKey => [
  'transactions',
  'list',
  transactionId,
  'risks',
  'ars-score',
];
export const AUDIT_LOGS_LIST = (searchParams: AnyParameters): QueryKey => [
  'audit-logs',
  searchParams,
];
export const USER_AUDIT_LOGS_LIST = (userId: string, searchParams: AnyParameters): QueryKey => [
  'users',
  userId,
  'audit-logs',
  searchParams,
];
export const CASE_AUDIT_LOGS_LIST = (caseId: string, searchParams: AnyParameters): QueryKey => [
  'cases',
  caseId,
  'audit-logs',
  searchParams,
];
export const TRANSACTIONS_STATS = (
  type: 'by-type' | 'by-date',
  searchParams: AnyParameters,
): QueryKey => ['transactions', 'stats', type, searchParams];
export const USERS_STATS = (
  params: AnyParameters & {
    userType?: 'BUSINESS' | 'CONSUMER';
    riskType?: string;
  },
): QueryKey => ['users', 'stats', params];
export const TRANSACTIONS_UNIQUES = (
  field: TransactionsUniquesField,
  params: {
    filter?: string;
  } = {},
): QueryKey => ['transactions', 'uniques', field, params];
export const USERS_UNIQUES = (
  field: UsersUniquesField,
  params: {
    filter?: string;
  } = {},
): QueryKey => ['users', 'uniques', field, params];
export const SANCTIONS_SEARCH = (params: AnyParameters): QueryKey => [
  'sanctions',
  'search',
  { params },
];
export const SANCTIONS_SEARCH_HISTORY = (searchId?: string): QueryKey =>
  ['sanctions', 'search', searchId].filter(Boolean);
export const SANCTIONS_SCREENING_STATS = (dateRange: any): QueryKey => [
  'sanctions-screening-stats',
  dateRange,
];
export const SANCTIONS_SCREENING_DETAILS = (params: AnyParameters): QueryKey => [
  'sanctions-screening-details',
  params,
];

export const RULE_LOGIC_CONFIG = (): QueryKey => ['rule-logic-config'];
export const RULES = (): QueryKey => ['rules'];
export const RULE_INSTANCES = (): QueryKey => ['rule-instances'];
export const RULE_FILTERS = (): QueryKey => ['rule-filters'];
export const HITS_PER_USER = (dateRange: RangeValue<Dayjs>, direction?: string): QueryKey =>
  ['hits-per-user', dateRange, direction].filter(Boolean);
export const HITS_PER_USER_STATS = (dateRange: RangeValue<Dayjs>): QueryKey => [
  'hits-per-user-stats',
  dateRange,
];
export const RULES_UNIVERSAL_SEARCH = (
  search: string,
  params?: AnyParameters,
  aiSearch?: boolean,
): QueryKey => ['rules-universal-search', search, params, aiSearch];

export const TRANSACTION_FILES = (params?: AnyParameters): QueryKey =>
  ['transaction-files', params].filter(Boolean);
export const USER_FILES = (params?: AnyParameters): QueryKey =>
  ['user-files', params].filter(Boolean);
export const RULES_AND_RULE_INSTANCES = (): QueryKey => ['rules-and-rule-instances'];
export const GET_RULES = (params: AnyParameters): QueryKey => ['get-rules', params];
export const GET_RULE = (id: string | undefined): QueryKey => ['rules', 'item', id];
export const GET_RULE_INSTANCES = (params: AnyParameters): QueryKey => [
  'get-rule-instances',
  params,
];
export const GET_RULES_INSTANCE = (id: string | undefined): QueryKey => [
  'rule-instances',
  'item',
  id,
];
export const WEBHOOKS = (id?: string): QueryKey => ['webhooks', id].filter(Boolean);
export const WEBHOOKS_LIST = (): QueryKey => ['webhooks', 'list'];
export const USERS = (type: string, params?: AnyParameters): QueryKey =>
  ['users', type, params].filter(Boolean);
export const USER_EVENTS_LIST = (params: AnyParameters): QueryKey => [
  'user-events',
  'list',
  params,
];
export const USERS_ITEM = (userId: string | undefined): QueryKey => ['users', 'item', userId];

export const USERS_ITEM_RISKS_DRS = (userId: string): QueryKey => [
  'users',
  'item',
  userId,
  'risks',
  'drs-score',
];

export const MERCHANT_SUMMARY = (userId: string): QueryKey => ['merchant', 'summary', userId];
export const MERCHANT_SUMMARY_HISTORY = (
  userId: string,
  source: MerchantMonitoringSource,
): QueryKey => ['merchant', 'summary', userId, source.sourceType, source.sourceValue];
export const USERS_ITEM_RISKS_KRS = (userId: string): QueryKey => [
  'users',
  'item',
  userId,
  'risks',
  'krs-score',
];
export const ALERT_LIST = (params?: AnyParameters): QueryKey =>
  ['alerts', 'list', params].filter(Boolean);
export const SIMULATION_JOB = (jobId: string | undefined): QueryKey => ['simulation', jobId];
export const SIMULATION_JOB_ITERATION_RESULT = (taskId: string, params?: AnyParameters): QueryKey =>
  ['simulation', 'iteration', taskId, params].filter(Boolean);
export const SIMULATION_JOBS = (params?: AnyParameters): QueryKey =>
  ['simulation', params].filter(Boolean);
export const ALERT_ITEM_TRANSACTION_LIST = (alertId: string, params?: AnyParameters): QueryKey =>
  ['alerts', 'item', alertId, 'transactions', 'list', params].filter(Boolean);
export const QA_SAMPLE_IDS = () => ['qa-samples', 'ids'];
export const SANCTIONS_SEARCH_LIST = (searchIds: string[]): QueryKey => [
  'sanctions',
  'list-by-ids',
  searchIds,
];
export const ALERT_ITEM = (alertId: string): QueryKey => ['alerts', 'item', alertId];
export const ALERT_CHECKLIST = (alertId: string | undefined): QueryKey => [
  'alerts',
  'checklist',
  alertId,
];
export const ALERT_QA_SAMPLING = (params: AnyParameters): QueryKey => [
  'alerts',
  'qa-sampling',
  params,
];
export const ALERT_QA_SAMPLE = (sampleId: string): QueryKey => ['alerts', 'qa-sample', sampleId];
export const SIMULATION_COUNT = (): QueryKey => ['simulation', 'count'];
export const ALERT_ITEM_COMMENTS = (alertId: string): QueryKey => [
  'alerts',
  'item',
  alertId,
  'comments',
];
export const RISK_CLASSIFICATION_VALUES = (): QueryKey => ['risk-classification-values'];
export const NARRATIVE_TEMPLATE_LIST = (params?: AnyParameters): QueryKey => [
  'narrative-templates',
  'list',
  params,
];
export const NARRATIVE_TEMPLATE_ITEM = (id: string): QueryKey => [
  'narrative-templates',
  'item',
  id,
];

export const DASHBOARD_TEAM_STATS = (params: AnyParameters): QueryKey => [
  'dashboard',
  'team',
  params,
];

export const COPILOT = (entityId: string): QueryKey => ['copilot', entityId];

export const COPILOT_AI_RESOURCES = (): QueryKey => ['copilot', 'aiSources'];

export const REPORTS_TEMPLATE = (params: AnyParameters): QueryKey => [
  'reports',
  'template',
  params,
];

export const DASHBOARD_OVERVIEW = (): QueryKey => ['dashboard', 'overview'];

export const DASHBOARD_TRANSACTIONS_STATS = (params: AnyParameters): QueryKey => [
  'dashboard',
  'transactions',
  params,
];
export const SHADOW_RULES_ANALYTICS = (params: AnyParameters): QueryKey => [
  'shadow-rules-analytics',
  params,
];

export const DASHBOARD_TRANSACTIONS_TOTAL_STATS = (params: AnyParameters): QueryKey => [
  'dashboard',
  'transactions',
  'total',
  params,
];

export const DASHBOARD_OVERVIEW_TOTAL = (): QueryKey => ['dashboard', 'overview-total'];

export const CLOSING_REASON_DISTRIBUTION = (entity: string, params: AnyParameters): QueryKey => [
  'dashboard',
  'case-management',
  entity,
  params,
];

export const ALERT_PRIORITY_DISTRIBUTION = (params: AnyParameters): QueryKey => [
  'dashboard',
  'alert-priority-distribution',
  params,
];

export const TRANSACTION_TYPE_DISTRIBUTION = (): QueryKey => ['dashboard', 'transactions'];

export const DASHBOARD_STATS_QA_ALERT_STATS_BY_CHECKLIST_REASON = (
  dateRange: RangeValue<Dayjs>,
  checklistTemplateId: string,
  checklistCategory: string,
): QueryKey =>
  ['qa-alert-stats-by-checklist-reason', dateRange, checklistCategory, checklistTemplateId].filter(
    Boolean,
  );

export const DASHBOARD_STATS_QA_ALERTS_BY_RULE_HIT = (dateRange: RangeValue<Dayjs>): QueryKey =>
  ['qa-alerts-by-rule-hits', dateRange].filter(Boolean);

export const DASHBOARD_STATS_QA_OVERVIEW = (dateRange: RangeValue<Dayjs>): QueryKey =>
  ['qa-overview', dateRange].filter(Boolean);

export const DASHBOARD_STATS_QA_ALERTS_BY_ASSIGNEE = (dateRange: RangeValue<Dayjs>): QueryKey =>
  ['qa-alerts-by-assignee', dateRange].filter(Boolean);

export const SETTINGS = (): QueryKey => ['settings'];

export const TENANT_USAGE_DATA = (): QueryKey => ['tenant-usage-data'];

export const CHECKLIST_TEMPLATES = (params?: AnyParameters): QueryKey =>
  ['checklist-templates', params].filter(Boolean);

export const COPILOT_ALERT_QUESTIONS = (alertId: string): QueryKey => [
  'copilot',
  'alert',
  alertId,
  'questions',
  'list',
];

export const COPILOT_SUGGESTIONS = (requestString: string): QueryKey => [
  'copilot',
  'suggestions',
  requestString,
];
export const RULE_QUEUES = (params?: AnyParameters): QueryKey =>
  ['rule-queues', params].filter(Boolean);
export const RULE_QUEUE = (queueId?: string): QueryKey => ['rule-queue', queueId];

export const RULE_ALERT_ASSIGNEES = (assigneeType: string): QueryKey => [
  'rule-alert-assignees',
  assigneeType,
];

export const NOTIFICATIONS = (notificationStatus?: 'ALL' | 'UNREAD'): QueryKey => [
  'notifications',
  `tab-${notificationStatus}`,
];

export const NEW_RULE_ID = (ruleId?: string): QueryKey => ['new-rule-id', ruleId];

export const SIMULATION_RISK_FACTOR = (jobId: string): QueryKey => [
  'risk-factor',
  'simulation',
  jobId,
];

export const RISK_FACTORS = (): QueryKey => ['risk-factor'];
