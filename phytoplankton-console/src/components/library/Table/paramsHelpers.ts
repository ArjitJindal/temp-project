/*
  Param utils
 */
import { PaginationParams } from '@/utils/queries/hooks';
import { PaginatedParams, SortingParams, SortedParams } from '@/components/library/Table/types';

export function pickPaginatedParams(params: PaginatedParams<unknown>): PaginationParams {
  return {
    pageSize: params.pageSize,
    page: params.page,
    from: params.from,
    pagination: params.pagination,
  };
}

export function pickSortingParams(params: SortedParams<unknown>): SortingParams {
  return {
    sort: params.sort,
  };
}
