import get from 'lodash/get'
import isEmpty from 'lodash/isEmpty'
import isNumber from 'lodash/isNumber'
import { validate as uuidValidate } from 'uuid'
import {
  Collection,
  Document,
  Filter,
  FindCursor,
  ObjectId,
  SortDirection,
  WithId,
} from 'mongodb'
import { ClickHouseClient } from '@clickhouse/client'
import { executeClickhouseQuery } from './clickhouse/utils'

export type PageSize = number
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 1000
export const COUNT_QUERY_LIMIT = 100000

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

export function getPageSizeNumber(pageSize: PageSize | 'DISABLED'): number {
  if (pageSize === 'DISABLED') {
    return Number.MAX_SAFE_INTEGER
  }
  return pageSize
}

export async function* iterateItems<T>(
  fn: (
    pagination: Pick<CursorPaginationParams, 'fromCursorKey'>
  ) => Promise<CursorPaginationResponse<T>>
): AsyncGenerator<T> {
  for await (const page of iteratePages(fn)) {
    for (const item of page) {
      yield item
    }
  }
}

export async function* iterateCursorItems<T>(
  fn: (pagination: {
    from: string
    pageSize: number
  }) => Promise<CursorPaginationResponse<T>>
): AsyncGenerator<T> {
  let from = ''
  do {
    const { items, hasNext, next } = await fn({
      from,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    for (const item of items) {
      yield item
    }
    from = hasNext ? next : ''
  } while (from !== '' && from != null)
}

export async function* iteratePages<T>(
  fn: (
    pagination: Pick<CursorPaginationParams, 'fromCursorKey'>
  ) => Promise<CursorPaginationResponse<T>>
): AsyncGenerator<T[]> {
  let nextCursor: string | undefined = undefined
  do {
    const page = await fn({ fromCursorKey: nextCursor })
    nextCursor = page.next
    yield page.items
  } while (nextCursor != undefined && nextCursor !== '')
}

export interface CursorPaginationParams {
  pageSize?: number
  sortField?: string
  fromCursorKey?: string
  sortOrder?: 'ascend' | 'descend'
}

const PAGINATION_CURSOR_KEY_SEPERATOR = '___'

export async function cursorPaginate<T extends Document>(
  collection: Collection<T>,
  filter: Filter<WithId<T>>,
  query: CursorPaginationParams,
  projection?: Document
): Promise<CursorPaginationResponse<WithId<T>>> {
  const field = query.sortField || '_id'
  const fromRaw: any = query.fromCursorKey || ''
  const fromOperator = query.sortOrder === 'ascend' ? '$gt' : '$lt'
  const toOperator = query.sortOrder === 'ascend' ? '$lt' : '$gt'
  const direction: SortDirection = query.sortOrder === 'ascend' ? 1 : -1
  const prevDirection: SortDirection = query.sortOrder === 'ascend' ? -1 : 1
  let findFilters = [filter]
  let prevFindFilters = [filter]
  const lastFindFilters = [filter]

  // Decode cursor from base64
  const buff = Buffer.from(fromRaw, 'base64')
  const from = buff.toString('ascii')

  const [sortValue, id] = from.split(PAGINATION_CURSOR_KEY_SEPERATOR)
  const isUUID = uuidValidate(id)
  let parsedSortValue: any = sortValue
  // Parse fields that are not string values
  const asNumber = parseFloat(sortValue)
  if (!isNaN(asNumber)) {
    parsedSortValue = asNumber
  }

  if (parsedSortValue === 'EMPTY') {
    parsedSortValue = undefined
  }
  // Filter query
  if (from) {
    let fromOr: any = { [field]: { [fromOperator]: parsedSortValue } }
    if (parsedSortValue === undefined && query.sortOrder === 'ascend') {
      fromOr = { [field]: { $exists: true } }
    }
    findFilters = findFilters.concat({
      $or: [
        fromOr,
        {
          [field]: { $eq: parsedSortValue },
          _id: { [fromOperator]: isUUID ? id : new ObjectId(id) },
        },
      ],
    })

    let prevOr: any = { [field]: { [toOperator]: parsedSortValue } }
    if (parsedSortValue === undefined && query.sortOrder === 'descend') {
      prevOr = { [field]: { $exists: true } }
    }
    prevFindFilters = prevFindFilters.concat({
      $or: [
        prevOr,
        {
          [field]: { $eq: parsedSortValue },
          _id: { [toOperator]: isUUID ? id : new ObjectId(id) },
        },
      ],
    })
  }

  // Sort query
  const findCursor = collection
    .find({ $and: findFilters })
    .sort({ [field]: direction })
    .project(projection ?? {}) as FindCursor<WithId<T>>
  const prevFindCursor = collection
    .find({ $and: prevFindFilters })
    .sort({ [field]: prevDirection })
    .project(projection ?? {}) as FindCursor<WithId<T>>
  const lastFindCursor = collection
    .find({ $and: lastFindFilters })
    .sort({ [field]: prevDirection })
    .project(projection ?? {}) as FindCursor<WithId<T>>
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

  const count = await countDocuments(collection, filter)

  const itemsOnLastPage = count % pageSize || pageSize
  const hasLastPage = count > pageSize

  // For the "last" cursor, we need the item BEFORE the last page starts
  // so that when using $gt, we get the first item of the last page.
  // This is because the last page is not included in the results.

  const [items, { hasPrev, prev }, lastItems] = await Promise.all([
    findCursor.limit(pageSize + 1).toArray(),
    getPrevCursor(prevFindCursor, query),
    hasLastPage ? lastFindCursor.skip(itemsOnLastPage).limit(1).toArray() : [],
  ])

  const lastItem = hasLastPage ? lastItems.at(0) : undefined
  const last = cursor(lastItem, field)

  // Remove extra item
  let hasNext = false
  if (items.length > pageSize) {
    hasNext = items.length > pageSize
    items.pop()
  }

  let next = ''
  if (hasNext) {
    const lastItem = items.at(-1)
    // Encode cursor
    next = cursor(lastItem, field)
  }

  return {
    items,
    next,
    prev,
    last,
    hasNext,
    hasPrev,
    count,
    limit: COUNT_QUERY_LIMIT,
    pageSize: query.pageSize,
  }
}

async function getPrevCursor<T>(
  prevFind: FindCursor<WithId<T>>,
  query: CursorPaginationParams
): Promise<{ prev: string; hasPrev: boolean }> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  if (!query.fromCursorKey) {
    return { hasPrev: false, prev: '' }
  }
  const prevItems = await prevFind.limit(pageSize + 1).toArray()
  const prevItem = prevItems.at(-2)

  if (!prevItem || prevItems.length === pageSize - 1) {
    return { hasPrev: true, prev: '' }
  }

  return { hasPrev: true, prev: cursor(prevItem, query.sortField ?? '_id') }
}

export async function offsetPaginateClickhouse<T>(
  client: ClickHouseClient,
  dataTableName: string,
  queryTableName: string,
  query: ClickhousePaginationParams,
  where = '1',
  columnsProjection: Record<string, string>,
  callbackMap?: (item: Record<string, string | number>) => T,
  countWhereClause?: string
): Promise<{ items: T[]; count: number }> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  const sortField = (query.sortField || 'id').replace(/\./g, '_')
  const sortOrder = query.sortOrder || 'ascend'
  const page = query.page || 1
  const offset = (page - 1) * pageSize

  const columnsProjectionString = Object.entries(columnsProjection)
    .map(([key, value]) => `${value} AS ${key}`)
    .join(', ')

  const direction = sortOrder === 'descend' ? 'DESC' : 'ASC'
  const findSql = `SELECT ${
    columnsProjectionString.length > 0 ? columnsProjectionString : '*'
  } FROM ${dataTableName} FINAL WHERE id IN (SELECT DISTINCT id FROM ${queryTableName} FINAL ${
    where ? `WHERE timestamp != 0 AND ${where}` : 'WHERE timestamp != 0'
  } ORDER BY ${sortField} ${direction} OFFSET ${offset} ROWS FETCH FIRST ${pageSize} ROWS ONLY)`

  const countWhere = countWhereClause === undefined ? where : countWhereClause
  const countQuery = `SELECT uniqExact(id) as count FROM ${queryTableName} ${
    countWhere
      ? `WHERE ${countWhere} AND timestamp != 0`
      : 'WHERE timestamp != 0'
  }`

  const [items, count] = await Promise.all([
    executeClickhouseQuery<Record<string, string | number>[]>(client, {
      query: findSql,
      format: 'JSONEachRow',
    }),

    executeClickhouseQuery<Array<{ count: number }>>(client, {
      query: countQuery,
      format: 'JSONEachRow',
    }),
  ])

  return {
    items: callbackMap
      ? items.map((item) => callbackMap(item))
      : (items as unknown as T[]),
    count: count[0].count,
  }
}

/**
 * Gets only the data from ClickHouse without calculating count
 */
export async function getClickhouseDataOnly<T>(
  client: ClickHouseClient,
  dataTableName: string,
  queryTableName: string,
  query: ClickhousePaginationParams,
  where = '1',
  columnsProjection: Record<string, string>,
  callbackMap?: (item: Record<string, string | number>) => T
): Promise<T[]> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  const sortField = (query.sortField || 'id').replace(/\./g, '_')
  const sortOrder = query.sortOrder || 'ascend'
  const page = query.page || 1
  const offset = (page - 1) * pageSize

  const columnsProjectionString = Object.entries(columnsProjection)
    .map(([key, value]) => `${value} AS ${key}`)
    .join(', ')

  // const sortFieldMapper: Record<string, string> = {
  //   originAmountDetails_transactionAmount: 'originAmountDetails_amount',
  //   destinationAmountDetails_transactionAmount:
  //     'destinationAmountDetails_amount',
  //   ars_score: 'arsScore',
  // }

  const direction = sortOrder === 'descend' ? 'DESC' : 'ASC'
  const sortedOrderQuery = `(SELECT DISTINCT id FROM ${queryTableName} FINAL ${
    where ? `WHERE timestamp != 0 AND ${where}` : 'WHERE timestamp != 0'
  } ORDER BY ${sortField} ${direction} OFFSET ${offset} ROWS FETCH FIRST ${pageSize} ROWS ONLY)`
  const sortedOrder = await executeClickhouseQuery<
    Record<string, string | number>[]
  >(client, {
    query: sortedOrderQuery,
    format: 'JSONEachRow',
  })
  const sortedIds = sortedOrder.map((row) => row.id)
  const findSql = `SELECT ${
    columnsProjectionString.length > 0 ? columnsProjectionString : '*'
  }, id FROM ${dataTableName} FINAL WHERE id IN (${sortedIds
    .map((id) => `'${id}'`)
    .join(',')})`

  const items = (
    await executeClickhouseQuery<Record<string, string | number>[]>(client, {
      query: findSql,
      format: 'JSONEachRow',
    })
  ).sort((a, b) => sortedIds.indexOf(a.id) - sortedIds.indexOf(b.id))

  return callbackMap
    ? items.map((item) => callbackMap(item))
    : (items as unknown as T[])
}

/**
 * Gets only the count from ClickHouse without fetching data
 */
export async function getClickhouseCountOnly(
  client: ClickHouseClient,
  queryTableName: string,
  where = '1',
  countWhereClause?: string
): Promise<number> {
  const countWhere = countWhereClause === undefined ? where : countWhereClause
  const countQuery = `SELECT count(*) as count FROM ${queryTableName} FINAL ${
    countWhere
      ? `WHERE ${countWhere} AND timestamp != 0`
      : 'WHERE timestamp != 0'
  }`

  const count = await executeClickhouseQuery<Array<{ count: number }>>(client, {
    query: countQuery,
    format: 'JSONEachRow',
  })

  return count[0].count
}

export async function offsetPaginateClickhousePreview<T>(
  client: ClickHouseClient,
  tableName: string,
  query: ClickhousePaginationParams,
  where = '1',
  columns: Record<string, string>,
  callbackMap?: (item: Record<string, string | number>) => T
): Promise<{ items: T[]; count: number }> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  const sortField = (query.sortField || 'timestamp').replace(/\./g, '_')
  const sortOrder = query.sortOrder || 'ascend'
  const page = query.page || 1
  const offset = (page - 1) * pageSize

  const columnsString = Object.entries(columns)
    .map(([key, value]) => `${value} AS ${key}`)
    .join(', ')

  const direction = sortOrder === 'descend' ? 'DESC' : 'ASC'

  const findSql = `
    SELECT DISTINCT ${columnsString}
    FROM ${tableName} FINAL
    WHERE ${where}
    ORDER BY ${sortField} ${direction}
    OFFSET ${offset} ROWS
    FETCH FIRST ${pageSize} ROWS ONLY
  `

  const countQuery = `
    SELECT uniqExact(id) as count 
    FROM ${tableName} 
    WHERE ${where}
  `

  const [items, count] = await Promise.all([
    executeClickhouseQuery<Record<string, string | number>[]>(client, {
      query: findSql,
      format: 'JSONEachRow',
    }),

    executeClickhouseQuery<Array<{ count: number }>>(client, {
      query: countQuery,
      format: 'JSONEachRow',
    }),
  ])

  return {
    items: callbackMap
      ? items.map((item) => callbackMap(item))
      : (items as unknown as T[]),
    count: isNumber(count[0].count) ? Number(count[0].count) : count[0].count,
  }
}

export async function offsetPaginateClickhouseWithoutDataTable(
  client: ClickHouseClient,
  queryTableName: string,
  query: ClickhousePaginationParams,
  where = '1',
  extraColumns?: Record<string, string>,
  includeTimestampFilter = true
): Promise<{ items: Record<string, any>[]; count: number }> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE
  const sortField = (query.sortField || 'id').replace(/\./g, '_')
  const sortOrder = query.sortOrder || 'ascend'
  const page = query.page || 1
  const offset = (page - 1) * pageSize

  const direction = sortOrder === 'descend' ? 'DESC' : 'ASC'

  // Build SELECT clause with extra columns
  let selectClause = 'id'
  if (extraColumns && Object.keys(extraColumns).length > 0) {
    const extraColumnsString = Object.entries(extraColumns)
      .map(([key, value]) => `${value} AS ${key}`)
      .join(', ')
    selectClause = `id, ${extraColumnsString}`
  }

  const findSql = `SELECT ${selectClause} FROM ${queryTableName} FINAL ${
    where
      ? `WHERE ${includeTimestampFilter ? 'timestamp != 0' : '1'} AND ${where}`
      : `WHERE ${includeTimestampFilter ? 'timestamp != 0' : '1'}`
  } ORDER BY ${sortField} ${direction} OFFSET ${offset} ROWS FETCH FIRST ${pageSize} ROWS ONLY`

  const countQuery = `SELECT uniqExact(id) as count FROM ${queryTableName} ${
    where ? `WHERE ${where} AND timestamp != 0` : 'WHERE timestamp != 0'
  }`

  const [items, count] = await Promise.all([
    executeClickhouseQuery<Record<string, any>[]>(client, {
      query: findSql,
      format: 'JSONEachRow',
    }),

    executeClickhouseQuery<Array<{ count: number }>>(client, {
      query: countQuery,
      format: 'JSONEachRow',
    }),
  ])

  return {
    items: items,
    count: isNumber(count[0].count) ? Number(count[0].count) : count[0].count,
  }
}

export async function cursorPaginateClickhouse<T>(
  client: ClickHouseClient,
  dataTableName: string,
  queryTableName: string,
  filter: string,
  query: CursorPaginationParams,
  columns: Record<string, string>,
  callback?: (item: Record<string, string | number>) => T
): Promise<CursorPaginationResponse<T>> {
  const field = query.sortField || 'timestamp'
  const fromRaw: any = query.fromCursorKey || ''
  const fromOperator = query.sortOrder === 'ascend' ? '>' : '<'
  const toOperator = query.sortOrder === 'ascend' ? '<' : '>'
  const direction = query.sortOrder === 'ascend' ? 'ASC' : 'DESC'
  const prevDirection = query.sortOrder === 'ascend' ? 'DESC' : 'ASC'
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

  const findFilters = [filter]
  const prevFindFilters = [filter]
  const lastFindFilters = [filter]

  // Decode cursor from base64
  const buff = Buffer.from(fromRaw, 'base64')
  const from = buff.toString('ascii')

  const [sortValue, id] = from.split(PAGINATION_CURSOR_KEY_SEPERATOR)
  let parsedSortValue: any = sortValue

  // Parse fields that are not string values
  if (sortValue && sortValue !== 'EMPTY') {
    const asNumber = parseFloat(sortValue)
    if (!isNaN(asNumber)) {
      parsedSortValue = asNumber
    }
  }

  if (parsedSortValue === 'EMPTY') {
    parsedSortValue = null
  }

  // Filter query
  if (from && sortValue && id) {
    // Format value for SQL query
    const formattedSortValue =
      parsedSortValue === null
        ? 'NULL'
        : typeof parsedSortValue === 'string'
        ? `'${parsedSortValue.replace(/'/g, "''")}'`
        : parsedSortValue

    // Forward pagination condition
    const fromCondition =
      parsedSortValue === null && query.sortOrder === 'ascend'
        ? `${field} IS NOT NULL`
        : `(${field} ${fromOperator} ${formattedSortValue} OR (${field} = ${formattedSortValue} AND id ${fromOperator} '${id.replace(
            /'/g,
            "''"
          )}')`

    findFilters.push(fromCondition)

    // Backward pagination condition
    const prevCondition =
      parsedSortValue === null && query.sortOrder === 'descend'
        ? `${field} IS NOT NULL`
        : `(${field} ${toOperator} ${formattedSortValue} OR (${field} = ${formattedSortValue} AND id ${toOperator} '${id.replace(
            /'/g,
            "''"
          )}')`

    prevFindFilters.push(prevCondition)
  }

  // Build column projections
  const columnsProjectionString = Object.entries(columns)
    .map(([key, value]) => `${value} AS ${key}`)
    .join(', ')

  // Main query (current page)
  const findSql = `
    SELECT ${columnsProjectionString}
    FROM ${dataTableName} FINAL
    WHERE id IN (
      SELECT DISTINCT id 
      FROM ${queryTableName} FINAL
      WHERE ${findFilters.join(' AND ')}
      ORDER BY ${field} ${direction}, id ${direction}
      LIMIT ${pageSize + 1}
    )
    ORDER BY ${field} ${direction}, id ${direction}
  `

  // Previous page query (for prev cursor)
  const prevSql = `
    SELECT ${columnsProjectionString}
    FROM ${dataTableName} FINAL
    WHERE id IN (
      SELECT DISTINCT id 
      FROM ${queryTableName} FINAL
      WHERE ${prevFindFilters.join(' AND ')}
      ORDER BY ${field} ${prevDirection}, id ${prevDirection}
      LIMIT ${pageSize + 1}
    )
    ORDER BY ${field} ${prevDirection}, id ${prevDirection}
  `

  // Count query (only on first page to avoid expensive count)
  const countSql = `
    SELECT uniqExact(id) as count
    FROM ${queryTableName}
    WHERE ${filter}
  `

  // Last page query (for last cursor)
  const lastSql = `
    SELECT ${columnsProjectionString}
    FROM ${dataTableName} FINAL
    WHERE id IN (
      SELECT DISTINCT id 
      FROM ${queryTableName} FINAL
      WHERE ${lastFindFilters.join(' AND ')}
      ORDER BY ${field} ${prevDirection}, id ${prevDirection}
      LIMIT ${pageSize + 1}
    )
    ORDER BY ${field} ${prevDirection}, id ${prevDirection}
  `

  // Execute queries
  const [items, prevItems, countResult, lastItems] = await Promise.all([
    executeClickhouseQuery<Record<string, string | number>[]>(client, {
      query: findSql,
      format: 'JSONEachRow',
    }),
    from
      ? executeClickhouseQuery<Record<string, string | number>[]>(client, {
          query: prevSql,
          format: 'JSONEachRow',
        })
      : Promise.resolve([]),
    !query.fromCursorKey
      ? executeClickhouseQuery<Array<{ count: number }>>(client, {
          query: countSql,
          format: 'JSONEachRow',
        })
      : Promise.resolve([{ count: 0 }]),
    executeClickhouseQuery<Record<string, string | number>[]>(client, {
      query: lastSql,
      format: 'JSONEachRow',
    }),
  ])

  const count = countResult[0]?.count || 0
  const itemsOnLastPage = count % pageSize || pageSize
  const hasLastPage = count > pageSize

  // Handle previous cursor
  const { hasPrev, prev } = await getClickhousePrevCursor(
    prevItems,
    query,
    field
  )

  // Handle last cursor
  const lastItem =
    hasLastPage && lastItems.length > itemsOnLastPage
      ? lastItems[itemsOnLastPage]
      : undefined
  const last = createClickhouseCursor(lastItem, field)

  // Remove extra item and determine if there's a next page
  let hasNext = false
  if (items.length > pageSize) {
    hasNext = true
    items.pop()
  }

  // Create next cursor
  const next =
    hasNext && items.length > 0
      ? createClickhouseCursor(items[items.length - 1], field)
      : ''

  const processedItems = callback
    ? items.map(callback)
    : (items as unknown as T[])

  return {
    items: processedItems,
    next,
    prev,
    last,
    hasNext,
    hasPrev,
    count,
    limit: COUNT_QUERY_LIMIT,
    pageSize,
  }
}

async function getClickhousePrevCursor(
  prevItems: Record<string, string | number>[],
  query: CursorPaginationParams,
  field: string
): Promise<{ prev: string; hasPrev: boolean }> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

  if (!query.fromCursorKey) {
    return { hasPrev: false, prev: '' }
  }

  if (prevItems.length === 0) {
    return { hasPrev: false, prev: '' }
  }

  const prevItem =
    prevItems.length >= 2 ? prevItems[prevItems.length - 2] : undefined

  if (!prevItem || prevItems.length === pageSize - 1) {
    return { hasPrev: true, prev: '' }
  }

  return { hasPrev: true, prev: createClickhouseCursor(prevItem, field) }
}

function createClickhouseCursor(
  item: Record<string, string | number> | undefined,
  sortField: string
): string {
  if (!item || !sortField) {
    return ''
  }

  const sortValue = get(item, sortField) ?? 'EMPTY'
  const itemId = item.id || item.userId
  const raw = `${sortValue}${PAGINATION_CURSOR_KEY_SEPERATOR}${itemId}`

  // Encode cursor
  return encodeCursor(raw)
}

function cursor<T>(item?: WithId<T>, sortField?: string): string {
  if (!item || !sortField) {
    return ''
  }
  const raw = [get(item, sortField) ?? 'EMPTY', item._id].join(
    PAGINATION_CURSOR_KEY_SEPERATOR
  )
  // Encode cursor
  return encodeCursor(raw)
}

async function countDocuments<T extends Document>(
  collection: Collection<T>,
  filter: Filter<WithId<T>>
): Promise<number> {
  if (isEmpty(filter)) {
    return await collection.estimatedDocumentCount()
  }

  return await collection.countDocuments(
    { $and: [filter] },
    { limit: COUNT_QUERY_LIMIT }
  )
}

function encodeCursor(raw: string): string {
  const buff = Buffer.from(raw)
  return buff.toString('base64')
}
