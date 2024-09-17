import { ClickHouseClient } from '@clickhouse/client'
import { executeSql } from '@/utils/viper'
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
  page?: number,
  pageSize?: number
): Promise<{ rows: T[]; total: number }> {
  const pageOrDefault = page || 1
  const pageSizeOrDefault = pageSize || DEFAULT_PAGE_SIZE
  const totalQuery = client.query({
    query: `select count(*) as total from ( ${clickhouseQuery} )`,
    format: 'JSONEachRow',
  })

  const queryString = `${clickhouseQuery} limit ${pageSizeOrDefault} offset ${
    (pageOrDefault - 1) * pageSizeOrDefault
  }`

  const query = client.query({
    query: queryString,
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
