import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { executeSql } from '@/utils/databricks'

export const UsersReceivedMoneyFrom: TableQuestion<Period & { top: number }> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.USERS_MONEY_RECEIVED_FROM,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top ${
      vars.top
    } users they have received money ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ userId, username }, { top, ...period }) => {
    const result = await executeSql<{
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
  sum(t.originAmountDetails.transactionAmount) as sum
from
  transactions t
  join users u on u.userId = t.originUserId
  and t.destinationUserId = :userId
  and t.timestamp between :from and :to
group by
  t.originUserId
order by
  count desc
LIMIT
  :limit
        `,
      {
        userId,
        limit: top,
        ...sqlPeriod(period),
      }
    )

    return {
      data: result.map((r) => [r.userId, r.name, r.userType, r.count, r.sum]),
      summary: `The top user that ${username} received money from was ${
        result.at(0)?.name
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
    top: 'INTEGER',
  },
  defaults: () => {
    return { top: 10 }
  },
}
