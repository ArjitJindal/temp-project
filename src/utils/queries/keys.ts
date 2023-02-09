import { RangeValue } from 'rc-picker/es/interface';
import { QueryKey } from '@tanstack/react-query';
import { Dayjs } from '@/utils/dayjs';
import { CaseType, ListType } from '@/apis';
import { TransactionsUniquesField } from '@/apis/models/TransactionsUniquesField';

type AnyParameters = unknown;

export const CASES_LIST = (type: CaseType, params: AnyParameters): QueryKey => [
  'cases',
  'list',
  type,
  { params },
];
export const CASES_ITEM = (transactionId: string): QueryKey => ['cases', transactionId];
export const CASES_ITEM_RULES = (caseId: string): QueryKey => ['cases', caseId, 'rules'];
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
export const LISTS_ITEM = (id: string): QueryKey => ['lists', 'item', id];
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
export const USER_INFO = (accessToken: string | null): QueryKey => ['userinfo', accessToken];
export const TRANSACTIONS_LIST = (searchParams: AnyParameters): QueryKey => [
  'transactions',
  'list',
  searchParams,
];
export const AUDIT_LOGS_LIST = (searchParams: AnyParameters): QueryKey => [searchParams];
export const TRANSACTIONS_STATS = (
  type: 'by-type' | 'by-date',
  searchParams: AnyParameters,
): QueryKey => ['transactions', 'stats', type, searchParams];
export const USERS_STATS = (): QueryKey => ['users', 'stats'];
export const TRANSACTIONS_UNIQUES = (
  field: TransactionsUniquesField,
  params: {
    filter?: string;
  } = {},
): QueryKey => ['transactions', 'uniques', field, params];
export const BUSINESS_USERS_UNIQUES = (): QueryKey => ['users', 'uniques'];
export const SANCTIONS_SEARCH = (params: AnyParameters): QueryKey => [
  'sanctions',
  'search',
  { params },
];
export const SANCTIONS_SEARCH_HISTORY = (searchId?: string): QueryKey => [
  'sanctions',
  'search',
  searchId,
];
export const RULES = (): QueryKey => ['rules'];
export const RULE_INSTANCES = (): QueryKey => ['rule-instances'];
export const RULE_FILTERS = (): QueryKey => ['rule-filters'];
export const HITS_PER_USER = (dateRange: RangeValue<Dayjs>, direction?: string): QueryKey => [
  'hits-per-user',
  dateRange,
  direction,
];
export const HITS_PER_USER_STATS = (dateRange: RangeValue<Dayjs>): QueryKey => [
  'hits-per-user-stats',
  dateRange,
];
export const TRANSACTION_FILES = (params?: AnyParameters): QueryKey => [
  'transaction-files',
  params,
];
export const USER_FILES = (params?: AnyParameters): QueryKey => ['user-files', params];
export const RULES_AND_RULE_INSTANCES = (): QueryKey => ['rules-and-rule-instances'];
export const GET_RULES = (): QueryKey => ['get-rules'];
export const GET_RULE_INSTANCES = (): QueryKey => ['get-rule-instances'];
export const WEBHOOKS = (id?: string): QueryKey => ['webhooks', id];
export const WEBHOOKS_LIST = (): QueryKey => ['webhooks', 'list'];
export const USERS = (type: string, params?: AnyParameters): QueryKey => ['users', type, params];
export const USERS_ITEM = (userId: string): QueryKey => ['users', 'item', userId];
