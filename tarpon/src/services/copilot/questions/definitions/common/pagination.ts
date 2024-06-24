import { executeSql } from '@/utils/databricks'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'

export async function paginatedSqlQuery<T>(
  sqlQuery: string,
  params: any,
  page?: number,
  pageSize?: number
): Promise<{ rows: T[]; total: number }> {
  const pageOrDefault = page || 1
  const pageSizeOrDefault = pageSize || DEFAULT_PAGE_SIZE
  const rowsQuery = executeSql<T>(`${sqlQuery} offset :offset limit :limit`, {
    ...params,
    limit: pageSizeOrDefault,
    offset: (pageOrDefault - 1) * pageSizeOrDefault,
  })
  const totalQuery = executeSql<{
    total: number
  }>(`select count(*) as total from ( ${sqlQuery} )`, {
    ...params,
  })

  return {
    rows: await rowsQuery,
    total: (await totalQuery)[0].total,
  }
}
