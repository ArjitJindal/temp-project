import { PageSize } from '@/@types/openapi-internal/PageSize'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export const COUNT_QUERY_LIMIT = 10000

export interface PaginationParams {
  pageSize?: PageSize
  page?: number
}

export interface OptionalPaginationParams {
  pageSize?: PageSize
  page?: number
}

export type OptionalPagination<Params> = Omit<Params, 'pageSize' | 'page'> &
  OptionalPaginationParams

export function getPageSizeNumber(pageSize: PageSize): number {
  if (pageSize === 'DISABLED') {
    return COUNT_QUERY_LIMIT
  }
  if (typeof pageSize === 'number') {
    return pageSize
  }
  return DEFAULT_PAGE_SIZE
}
