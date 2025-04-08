import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import { executeClickhouseQuery } from '@/utils/clickhouse/utils'
import { getContext } from '@/core/utils/context-storage'

export async function paginatedClickhouseQuery<T extends object>(
  clickhouseQuery: string,
  params: { [key: string]: string | number },
  page?: number,
  pageSize?: number
): Promise<{ rows: T[]; total: number }> {
  const pageOrDefault = page || 1
  const updatedParams = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  )
  const tenantId = getContext()?.tenantId as string
  const pageSizeOrDefault = pageSize || DEFAULT_PAGE_SIZE
  const offset = (pageOrDefault - 1) * pageSizeOrDefault
  const finalTotalQueryString = `select count(*) as total from ( ${clickhouseQuery} )`
  const totalQuery = executeClickhouseQuery<{ total: number }[]>(
    tenantId,
    finalTotalQueryString,
    {
      ...updatedParams,
      limit: pageSizeOrDefault.toString(),
      offset: offset.toString(),
    }
  )

  const queryString = `${clickhouseQuery} limit {{ limit }} offset {{ offset }}`

  const finalQueryString = queryString

  const query = executeClickhouseQuery<T[]>(tenantId, finalQueryString, {
    ...params,
    limit: pageSizeOrDefault.toString(),
    offset: offset.toString(),
  })

  const [totalQueryResult, queryResult] = await Promise.all([totalQuery, query])
  const total = totalQueryResult[0].total
  const rows = queryResult
  return {
    rows: rows,
    total: total,
  }
}
