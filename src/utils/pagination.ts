export type PageSize = number
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 1000
export const COUNT_QUERY_LIMIT = 10000

export interface PaginationParams {
  pageSize?: PageSize
  page?: number
}

export interface OptionalPaginationParams {
  pageSize?: PageSize | 'DISABLED'
  page?: number
}

export type OptionalPagination<Params> = Omit<Params, 'pageSize' | 'page'> &
  OptionalPaginationParams

export function getPageSizeNumber(pageSize: PageSize | 'DISABLED'): number {
  if (pageSize === 'DISABLED') {
    return Number.MAX_SAFE_INTEGER
  }
  return pageSize
}

export async function* iterateItems<T>(
  fn: (pagination: {
    page: number
    pageSize: number
  }) => Promise<{ total: number; data: T[] }>
): AsyncGenerator<T> {
  let totalPages = 1
  let page = 1
  while (page <= totalPages) {
    const { total, data } = await fn({
      page: page,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE)
    page++

    for (const item of data) {
      yield item
    }
  }
}
