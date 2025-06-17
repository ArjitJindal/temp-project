import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  Direction,
  directionDefault,
  directionVars,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getContext } from '@/core/utils/context-storage'
import {
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'

type Row = {
  userId: string
  name: string
  userType: string
  count: number
  sum: number
}

export const UsersTransactedWith: TableQuestion<
  Period & {
    currency: CurrencyCode
    direction: Direction
    sort?: [string, string]
  }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.USERS_TRANSACTED_WITH,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top {{userAlias}}s they have transacted with as ${vars.direction.toLowerCase()} ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { convert, userId, username },
    { page, pageSize, direction, currency, sortField, sortOrder, ...period }
  ) => {
    const userIdKey =
      direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
    const otherUserIdKey =
      direction === 'ORIGIN' ? 'destinationUserId' : 'originUserId'

    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    const derivedPageSize = pageSize || 20
    const derivedPage = page || 1
    const paginationQuery = `
      SELECT
        COUNT(*) AS count
      FROM transactions
      WHERE
          ${userIdKey} = '${userId}'
          AND timestamp between ${period.from} and ${period.to}
    `

    let orderByClause = ''

    if (sortField && sortOrder) {
      const direction = sortOrder === 'descend' ? 'DESC' : 'ASC'
      orderByClause = `ORDER BY ${sortField} ${direction}`
    }

    const clickhouseQuery = `
      WITH transactions_data AS (
      SELECT
          ${otherUserIdKey} AS userId,
          COUNT(*) AS count,
          SUM(originAmountDetails_amountInUsd) AS sum
      FROM transactions
      WHERE
          ${userIdKey} = '${userId}'
          AND timestamp between ${period.from} and ${period.to}
      GROUP BY ${otherUserIdKey}
      ORDER BY
          count DESC
      LIMIT ${derivedPageSize}
      OFFSET ${(derivedPage - 1) * derivedPageSize}
  ),
  users_data AS (
      SELECT
          username,
          type,
          id
      FROM users
      WHERE id IN (SELECT userId FROM transactions_data)
  )
  SELECT
      transactions_data.userId as userId,
      users_data.username as name,
      users_data.type as userType,
      transactions_data.count as count,
      transactions_data.sum as sum
      FROM transactions_data
      LEFT JOIN users_data
          ON transactions_data.userId = users_data.id
      ${orderByClause}
      `

    const tenantId = getContext()?.tenantId ?? ''
    const [rows, total] = await Promise.all([
      executeClickhouseQuery<Row[]>(tenantId, clickhouseQuery, {}),
      executeClickhouseQuery<{ count: number }[]>(
        tenantId,
        paginationQuery,
        {}
      ),
    ])

    const items = rows.map((r) => [
      r.userId,
      r.name,
      r.userType,
      r.count,
      convert(r.sum, currency),
    ])
    return {
      data: {
        items,
        total: total[0].count,
      },
      summary: !items.length
        ? `${username} has not transacted with anyone ${humanReadablePeriod(
            period
          )}.`
        : `The top user that ${username} has transacted with as ${direction.toLowerCase()} was ${
            rows.at(0)?.name
          } ${humanReadablePeriod(period)}.`,
    }
  },
  headers: [
    { name: '{{UserAlias}} ID', columnType: 'ID' },
    { name: '{{UserAlias}} name', columnType: 'STRING' },
    { name: '{{UserAlias}} type', columnType: 'TAG' },
    {
      name: 'Transaction Count',
      columnType: 'NUMBER',
      columnId: 'count',
      sortable: true,
    },
    {
      name: 'Total Amount',
      columnType: 'MONEY_AMOUNT',
      columnId: 'sum',
      sortable: true,
    },
  ],
  variableOptions: {
    ...periodVars,
    ...currencyVars,
    ...directionVars,
  },
  defaults: () => {
    return {
      ...periodDefaults(),
      ...currencyDefault,
      ...directionDefault,
    }
  },
}
