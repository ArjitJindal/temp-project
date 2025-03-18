import { RangeValue } from 'rc-picker/es/interface';
import { QueryKey } from '@tanstack/react-query';
import { compact } from 'lodash';
import { Dayjs } from '@/utils/dayjs';
import { ListType, ReasonType } from '@/apis';
import { TransactionsUniquesField } from '@/apis/models/TransactionsUniquesField';
import { UsersUniquesField } from '@/apis/models/UsersUniquesField';
import { CrmModelType } from '@/apis/models/CrmModelType';

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
export const LISTS_OF_TYPE = (type: ListType | undefined): QueryKey => ['lists', { type }, 'list'];
export const LISTS_ITEM = (id?: string, type?: ListType): QueryKey => ['lists', 'item', id, type];
export const LISTS_ITEM_TYPE = (id: string, type: ListType, params?: AnyParameters): QueryKey => [
  'lists',
  'item',
  id,
  type,
  params,
];
export const LISTS = (): QueryKey => ['lists'];
export const USERS_ITEM_TRANSACTIONS_HISTORY = (
  userId: string,
  params: AnyParameters,
): QueryKey => ['users', userId, 'transactions-history', params];
export const TRANSACTIONS_ITEM = (transactionId: string): QueryKey => [
  'transactions',
  'item',
  transactionId,
];

export const TRANSACTIONS_ALERTS_LIST = (transactionId: string): QueryKey => [
  'transactions',
  'item',
  transactionId,
  'alerts',
  'list',
];
export const USERS_FIND = (search: string): QueryKey => ['users', 'list', 'search', search];
export const TRANSACTIONS_FIND = (search: string): QueryKey => [
  'transactions',
  'list',
  'search',
  search,
];
export const TRANSACTIONS_EVENTS_FIND = (transactionId: string, params: any): QueryKey => [
  'transactions',
  'events',
  'list',
  transactionId,
  params,
];
export const ACCOUNT_LIST = (): QueryKey => ['accounts', 'list'];
export const USER_INFO = (accessToken: string | null): QueryKey => ['userinfo', accessToken];
export const CRM_ACCOUNT = (userId: string): QueryKey => ['crmaccount', userId];
export const CRM_RECORDS = (
  email: string,
  model: CrmModelType,
  page?: number,
  pageSize?: number,
  sortOrder?: 'ascend' | 'descend',
): QueryKey => ['crmrecords', email, model, page, pageSize, sortOrder];

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
export const REPORTS_LIST = (params?: AnyParameters): QueryKey =>
  compact(['reports', 'list', params]);
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
export const SANCTIONS_SEARCH_HISTORY = (searchId?: string, params?: AnyParameters): QueryKey =>
  ['sanctions', 'search', searchId, params].filter(Boolean);
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
export const RULE_INSTANCES = (mode?: 'LIVE' | 'SHADOW' | 'ALL'): QueryKey =>
  ['rule-instances', mode].filter(Boolean);
export const RULE_FILTERS = (): QueryKey => ['rule-filters'];
export const HITS_PER_USER = (
  dateRange: RangeValue<Dayjs>,
  type: string,
  direction?: string,
): QueryKey => ['hits-per-user', dateRange, type, direction].filter(Boolean);
export const HITS_PER_USER_STATS = (dateRange: RangeValue<Dayjs>): QueryKey => [
  'hits-per-user-stats',
  dateRange,
];

export const RULES_HIT_STATS = (
  dateRange: RangeValue<Dayjs>,
  page?: number,
  pageSize?: number,
): QueryKey => ['rules-hit-stats', dateRange, page, pageSize];

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
export const GET_RULE_INSTANCES = (params?: AnyParameters): QueryKey =>
  ['get-rule-instances', params].filter(Boolean);
export const GET_RULE_INSTANCE = (ruleInstanceId: string): QueryKey => [
  'rule-instance',
  ruleInstanceId,
];
export const RULES_WITH_ALERTS = (): QueryKey => ['rules', 'with-alerts'];
export const WEBHOOKS = (id?: string, params?: AnyParameters): QueryKey =>
  ['webhooks', id, params].filter(Boolean);
export const WEBHOOKS_LIST = (): QueryKey => ['webhooks', 'list'];
export const USERS = (type: string, params?: AnyParameters): QueryKey =>
  ['users', type, params].filter(Boolean);
export const USER_EVENTS_LIST = (params: AnyParameters): QueryKey => [
  'user-events',
  'list',
  params,
];
export const USERS_ITEM = (userId: string | undefined): QueryKey => ['users', 'item', userId];
export const USERS_ENTITY = (userId: string | undefined): QueryKey => ['users', 'entity', userId];

export const USERS_ITEM_RISKS_DRS = (userId: string): QueryKey => [
  'users',
  'item',
  userId,
  'risks',
  'drs-score',
];
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
export const ALERT_ITEM_TRANSACTION_STATS = (alertId: string): QueryKey =>
  ['alerts', 'item', alertId, 'transactions', 'stats'].filter(Boolean);
export const QA_SAMPLE_IDS = () => ['qa-samples', 'ids'];
export const SANCTIONS_SEARCH_LIST = (searchIds: string[]): QueryKey => [
  'sanctions',
  'list-by-ids',
  searchIds,
];
export const SANCTIONS_HITS_ALL = (): QueryKey => ['sanctions', 'hits', 'search'];
export const SANCTIONS_HITS_SEARCH = (params: AnyParameters): QueryKey => [
  'sanctions',
  'hits',
  'search',
  params,
];
export const SANCTIONS_WHITELIST_SEARCH = (params: AnyParameters): QueryKey => [
  'sanctions',
  'whitelist',
  'search',
  params,
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

export const SLA_POLICY_LIST = (params?: AnyParameters): QueryKey => ['sla-policy', 'list', params];

export const SLA_POLICY_ID = (policyId: string): QueryKey => ['new-sla-policy-id', policyId];

export const SLA_POLICY = (policyId: string): QueryKey => ['sla-policy', policyId];

export const DASHBOARD_TEAM_STATS = (params: AnyParameters): QueryKey => [
  'dashboard',
  'team',
  'performance',
  params,
];

export const DASHBOARD_TEAM_SLA_STATS = (params: AnyParameters): QueryKey => [
  'dashboard',
  'team',
  'sla',
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
export const RULE_STATS = (params: AnyParameters): QueryKey => ['rules-stats', params];

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

export const NEW_RISK_FACTOR_ID = (riskId?: string): QueryKey => ['new-risk-factor-id', riskId];

export const SIMULATION_RISK_FACTOR = (jobId: string): QueryKey => [
  'risk-factor',
  'simulation',
  jobId,
];

export const RISK_FACTORS = (): QueryKey => ['risk-factor'];
export const USER_TRS_RISK_SCORES = (userId: string): QueryKey => [
  'users',
  'item',
  userId,
  'risks',
  'trs-score',
];

export const RISK_FACTORS_V8 = (type?: string, includeV2?: boolean): QueryKey => [
  'custom-risk-factors',
  type,
  includeV2,
];
export const CUSTOM_RISK_FACTORS_ITEM = (type: string, id?: string): QueryKey => [
  'custom-risk-factors',
  type,
  `risk-factor-${id}`,
];

export const MACHINE_LEARNING_MODELS = (params?: AnyParameters) => [
  'machine-learning-models',
  params,
];

export const ACTION_REASONS = (type?: ReasonType) => ['action-reasons', type];

export const THRESHOLD_RECOMMENDATIONS = (instanceId: string) => [
  'threshold-recommendations',
  instanceId,
];
