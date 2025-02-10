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
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getContext } from '@/core/utils/context'
import {
  executeClickhouseQuery,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'

type Row = {
  userId: string
  name: string
  userType: string
  count: number
  sum: number
}

export const UsersTransactedWith: TableQuestion<
  Period & { currency: CurrencyCode; direction: Direction }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.USERS_TRANSACTED_WITH,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top users they have transacted with as ${vars.direction.toLowerCase()} ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { convert, userId, username },
    { page, pageSize, direction, currency, ...period }
  ) => {
    const userIdKey =
      direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
    const otherUserIdKey =
      direction === 'ORIGIN' ? 'destinationUserId' : 'originUserId'

    let rows: Row[] = []
    let total = 0

    if (isClickhouseEnabled()) {
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
      `

      const [data, totalData] = await Promise.all([
        executeClickhouseQuery<Row>(
          getContext()?.tenantId ?? '',
          clickhouseQuery,
          {}
        ),
        executeClickhouseQuery<{ count: number }>(
          getContext()?.tenantId ?? '',
          paginationQuery,
          {}
        ),
      ])

      rows = data
      total = totalData[0].count
    } else {
      const { rows: data, total: totalData } = await paginatedSqlQuery<Row>(
        `
select
  t.${otherUserIdKey} as userId,
  any_value(case when u.type = 'CONSUMER' THEN u.userDetails.name.firstName ELSE u.legalEntity.companyGeneralDetails.legalName END) as name,
  any_value(u.type) as userType,
  count(*) as count,
  sum(t.transactionAmountUSD) as sum
from
  transactions t
  join users u on u.userId = t.${otherUserIdKey}
  and t.${userIdKey} = :userId
  and t.timestamp between :from and :to
group by
  t.${otherUserIdKey}
order by
  count desc`,
        {
          userId,
          ...sqlPeriod(period),
        },
        page,
        pageSize
      )

      rows = data
      total = totalData
    }

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
        total,
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
    { name: 'User ID', columnType: 'ID' },
    { name: 'Username', columnType: 'STRING' },
    { name: 'User type', columnType: 'TAG' },
    { name: 'Transaction Count', columnType: 'NUMBER' },
    { name: 'Total Amount', columnType: 'MONEY_AMOUNT' },
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
