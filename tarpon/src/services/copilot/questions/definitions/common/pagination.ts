import { ClickHouseClient } from '@clickhouse/client'
import { executeSql, replacePlaceholders } from '@/utils/viper'
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

export async function paginatedClickhouseQuery<T>(
  client: ClickHouseClient,
  clickhouseQuery: string,
  params: { [key: string]: string | number },
  page?: number,
  pageSize?: number
): Promise<{ rows: T[]; total: number }> {
  const pageOrDefault = page || 1
  const pageSizeOrDefault = pageSize || DEFAULT_PAGE_SIZE
  const offset = (pageOrDefault - 1) * pageSizeOrDefault
  const finalTotalQueryString = replacePlaceholders(
    `select count(*) as total from ( ${clickhouseQuery} )`,
    params
  )
  const totalQuery = client.query({
    query: finalTotalQueryString,
    format: 'JSONEachRow',
  })

  const queryString = `${clickhouseQuery} limit :limit offset :offset`

  const finalQueryString = replacePlaceholders(queryString, {
    ...params,
    limit: pageSizeOrDefault,
    offset: offset,
  })

  const query = client.query({
    query: finalQueryString,
    format: 'JSONEachRow',
  })

  const [totalQueryResult, queryResult] = await Promise.all([totalQuery, query])
  const total = (await totalQueryResult.json<{ total: number }>())[0].total
  const rows = await queryResult.json<T>()
  return {
    rows: rows,
    total: total,
  }
}
