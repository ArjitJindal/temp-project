import { QueryKey } from '@tanstack/react-query';
import { ListType } from '@/apis';

type AnyParameters = unknown;

export const CASES_LIST = (params: AnyParameters): QueryKey => ['cases', 'list', { params }];
export const CASES_ITEM = (transactionId: string): QueryKey => ['cases', transactionId];
export const LISTS_OF_TYPE = (type: ListType): QueryKey => ['lists', { type }, 'list'];
export const LISTS_ITEM = (id: string): QueryKey => ['lists', 'item', id];
export const LISTS = (): QueryKey => ['lists'];
export const USERS_ITEM_TRANSACTIONS_HISTORY = (
  userId: string,
  params: AnyParameters,
): QueryKey => ['users', userId, 'transactions-history', params];
export const USERS_FIND = (search: string): QueryKey => ['users', 'list', 'search', search];
