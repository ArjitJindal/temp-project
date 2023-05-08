import { FindCursor, ObjectId, SortDirection, WithId } from 'mongodb'
import _ from 'lodash'
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

export interface CursorPaginationParams {
  first: number
  sortField?: string
  fromCursorKey?: string
  sortOrder?: 'ascend' | 'descend'
}

const PAGINATION_CURSOR_KEY_SEPERATOR = '___'

export async function cursorPaginate<T>(
  find: FindCursor<WithId<T>>,
  query: CursorPaginationParams,
  mapping?: { [field: string]: 'number' | 'string' }
): Promise<{
  items: WithId<T>[]
  next: string
  prev: string
  hasNext: boolean
  hasPrev: boolean
}> {
  const field = query.sortField || '_id'
  const fromRaw: any = query.fromCursorKey || ''
  const fromOperator = query.sortOrder === 'ascend' ? '$gt' : '$lt'
  const toOperator = query.sortOrder === 'ascend' ? '$lt' : '$gt'
  const direction: SortDirection = query.sortOrder === 'ascend' ? 1 : -1
  const prevDirection: SortDirection = query.sortOrder === 'ascend' ? -1 : 1
  let prevFind = find.clone()

  // Decode cursor from base64
  const buff = new Buffer(fromRaw, 'base64')
  const from = buff.toString('ascii')

  const [sortValue, id] = from.split(PAGINATION_CURSOR_KEY_SEPERATOR)

  let parsedSortValue: any = sortValue
  // Parse fields that are not string values
  if (mapping && mapping[field]) {
    if (mapping[field] === 'number') {
      parsedSortValue = sortValue !== 'EMPTY' ? parseInt(sortValue) : undefined
    }
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

    find = find.filter({
      $or: [
        fromOr,
        {
          [field]: { $eq: parsedSortValue },
          _id: { [fromOperator]: new ObjectId(id) },
        },
      ],
    })

    let prevOr: any = { [field]: { [toOperator]: parsedSortValue } }
    if (parsedSortValue === undefined && query.sortOrder === 'descend') {
      prevOr = { [field]: { $exists: true } }
    }
    prevFind = prevFind.filter({
      $or: [
        prevOr,
        {
          [field]: { $eq: parsedSortValue },
          _id: { [toOperator]: new ObjectId(id) },
        },
      ],
    })
  }

  // Sort query
  find = find.sort({ [field]: direction, _id: direction })
  prevFind = prevFind.sort({ [field]: prevDirection, _id: prevDirection })

  // Find prev
  const prevCursorPromise = getPrevCursor(prevFind, query)

  // Determine next cursor
  const items = await find
    .clone()
    .limit(query.first + 1)
    .toArray()
  let next = ''

  const { hasPrev, prev } = await prevCursorPromise

  // Remove extra item
  let hasNext = false
  if (items.length > query.first) {
    hasNext = items.length > query.first
    items.pop()
  }

  if (hasNext) {
    const lastItem = items.at(-1)
    const nextRaw = [_.get(lastItem, field) ?? 'EMPTY', lastItem?._id].join(
      PAGINATION_CURSOR_KEY_SEPERATOR
    )

    next = nextRaw

    // Encode cursor
    next = encodeCursor(nextRaw)
  }

  return {
    items,
    next,
    prev: from ? prev : '',
    hasNext,
    hasPrev,
  }
}

async function getPrevCursor<T>(
  prevFind: FindCursor<WithId<T>>,
  query: CursorPaginationParams
): Promise<{ prev: string; hasPrev: boolean }> {
  if (!query.fromCursorKey || query.fromCursorKey === '') {
    return { hasPrev: false, prev: '' }
  }
  const prevItems = await prevFind.limit(query.first + 1).toArray()
  const prevItem = prevItems.at(-2)

  if (!prevItem || prevItems.length === query.first - 1) {
    return { hasPrev: true, prev: '' }
  }
  const prevRaw = [
    _.get(prevItem, query.sortField as string) ?? 'EMPTY',
    prevItem?._id,
  ].join(PAGINATION_CURSOR_KEY_SEPERATOR)
  // Encode cursor
  const prev = encodeCursor(prevRaw)
  return { hasPrev: true, prev }
}

function encodeCursor(raw: string): string {
  const buff = new Buffer(raw)
  return buff.toString('base64')
}
