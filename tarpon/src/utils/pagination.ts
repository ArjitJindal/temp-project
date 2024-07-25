import { get, isEmpty } from 'lodash'
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

export type PageSize = number
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 1000
export const COUNT_QUERY_LIMIT = 100000

export interface PaginationParams {
  pageSize?: PageSize
  page?: number
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
  pageSize?: number
  sortField?: string
  fromCursorKey?: string
  sortOrder?: 'ascend' | 'descend'
}

const PAGINATION_CURSOR_KEY_SEPERATOR = '___'

export async function cursorPaginate<T extends Document>(
  collection: Collection<T>,
  filter: Filter<WithId<T>>,
  query: CursorPaginationParams
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
  const prevFindCursor = collection
    .find({ $and: prevFindFilters })
    .sort({ [field]: prevDirection })
  const lastFindCursor = collection
    .find({ $and: lastFindFilters })
    .sort({ [field]: prevDirection })

  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

  const [count, items, { hasPrev, prev }, lastItems] = await Promise.all([
    countDocuments(collection, filter),
    findCursor.limit(pageSize + 1).toArray(),
    getPrevCursor(prevFindCursor, query),
    lastFindCursor.skip(pageSize).limit(1).toArray(),
  ])
  const lastItem = lastItems.at(-1)

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
  if (!query.fromCursorKey || query.fromCursorKey === '') {
    return { hasPrev: false, prev: '' }
  }
  const prevItems = await prevFind.limit(pageSize + 1).toArray()
  const prevItem = prevItems.at(-2)

  if (!prevItem || prevItems.length === pageSize - 1) {
    return { hasPrev: true, prev: '' }
  }

  return { hasPrev: true, prev: cursor(prevItem, query.sortField ?? '_id') }
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
