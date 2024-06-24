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
    const { rows, total } = await paginatedSqlQuery<{
      userId: string
      name: string
      userType: string
      count: number
      sum: number
    }>(
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
      summary: `The top user that ${username} has transacted with as ${direction.toLowerCase()} was ${
        rows.at(0)?.name
      }.`,
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
