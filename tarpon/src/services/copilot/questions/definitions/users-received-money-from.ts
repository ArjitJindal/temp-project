import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export const UsersReceivedMoneyFrom: TableQuestion<
  Period & { currency: CurrencyCode }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.USERS_MONEY_RECEIVED_FROM,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top users they have received money ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    { convert, userId, username },
    { page, pageSize, currency, ...period }
  ) => {
    const { rows, total } = await paginatedSqlQuery<{
      userId: string
      name: string
      userType: string
      count: number
      sum: number
    }>(
      `
select
  t.originUserId as userId,
  FIRST(case when u.type = 'CONSUMER' THEN u.userDetails.name.firstName ELSE u.legalEntity.companyGeneralDetails.legalName END) as name,
  FIRST(u.type) as userType,
  count(*) as count,
  sum(t.transactionAmountUSD) as sum
from
  transactions t
  join users u on u.userId = t.originUserId
  and t.destinationUserId = :userId
  and t.timestamp between :from and :to
group by
  t.originUserId
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
      summary: `The top user that ${username} received money from was ${
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
  },
  defaults: () => {
    return {
      ...periodDefaults(),
      ...currencyDefault,
    }
  },
}
