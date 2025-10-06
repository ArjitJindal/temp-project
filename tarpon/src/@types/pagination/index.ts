export type PageSize = number

export interface PaginationParams {
  pageSize?: PageSize
  page?: number
}

export interface ClickhousePaginationParams {
  pageSize?: number
  sortField?: string
  page?: number
  sortOrder?: 'ascend' | 'descend'
}

export interface OptionalPaginationParams {
  pageSize?: PageSize | 'DISABLED'
  page?: number
}

export interface CursorPaginationResponse<T> {
  items: T[]
  next: string
  prev: string
  hasNext: boolean
  hasPrev: boolean
  count: number
  limit: number
  last: string
  pageSize?: number
}

export type OptionalPagination<Params> = Omit<Params, 'pageSize' | 'page'> &
  OptionalPaginationParams

export interface CursorPaginationParams {
  pageSize?: number
  sortField?: string
  fromCursorKey?: string
  sortOrder?: 'ascend' | 'descend'
}
