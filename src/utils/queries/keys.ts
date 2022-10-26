import { QueryKey } from '@tanstack/react-query';
import { CaseType, ListType } from '@/apis';

type AnyParameters = unknown;

export const CASES_LIST = (type: CaseType, params: AnyParameters): QueryKey => [
  'cases',
  'list',
  type,
  { params },
];
export const CASES_ITEM = (transactionId: string): QueryKey => ['cases', transactionId];
export const CASES_ITEM_TRANSACTIONS = (caseId: string, searchParams: AnyParameters): QueryKey => [
  'cases',
  caseId,
  'transactions',
  'list',
  searchParams,
];
export const LISTS_OF_TYPE = (type: ListType): QueryKey => ['lists', { type }, 'list'];
export const LISTS_ITEM = (id: string): QueryKey => ['lists', 'item', id];
export const LISTS = (): QueryKey => ['lists'];
export const USERS_ITEM_TRANSACTIONS_HISTORY = (
  userId: string,
  params: AnyParameters,
): QueryKey => ['users', userId, 'transactions-history', params];
export const USERS_FIND = (search: string): QueryKey => ['users', 'list', 'search', search];
export const ACCOUNT_LIST = (): QueryKey => ['accounts', 'list'];
export const TRANSACTIONS_LIST = (searchParams: AnyParameters): QueryKey => [
  'transactions',
  'list',
  searchParams,
];
export const TRANSACTIONS_STATS = (
  type: 'by-type' | 'by-date',
  searchParams: AnyParameters,
): QueryKey => ['transactions', 'stats', type, searchParams];
export const TRANSACTIONS_TAG_LIST = (): QueryKey => ['transactions', 'tags', 'list'];
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
export const RULE_FILTERS = (): QueryKey => ['rule-filters'];
