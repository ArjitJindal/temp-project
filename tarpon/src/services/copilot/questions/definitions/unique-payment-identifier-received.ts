import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  humanReadablePeriod,
  Period,
  periodVars,
  sqlPeriod,
} from '@/services/copilot/questions/definitions/util'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'

export const UniquePaymentIdentifierReceived: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.PAYMENT_IDENTIFIERS_OF_RECEIVERS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top payment identifiers they have received from ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { userId, username },
    { page, pageSize, ...period }
  ) => {
    const { rows, total } = await paginatedSqlQuery<{
      method: string
      count: number
      sum: number
      originPaymentDetails: PaymentDetails
    }>(
      `
    select
      first(t.originPaymentDetails.method) as as method,
      count(*) as count,
      sum(t.originAmountDetails.transactionAmount) as sum,
      t.originPaymentDetails as originPaymentDetails
    from
      transactions t
    where
      t.destinationUserId = :userId
      and t.timestamp between :from and :to
    group by
      t.originPaymentDetails
    order by
      sum desc
    `,
      {
        userId,
        ...sqlPeriod(period),
      },
      page,
      pageSize
    )

    const items = rows.map((r) => {
      return [
        getPaymentMethodId(r.originPaymentDetails),
        r.method,
        r.count,
        r.sum,
      ]
    })

    return {
      data: {
        items,
        total,
      },
      summary: `The top payment identifier that ${username} received money from was ${getPaymentMethodId(
        rows.at(0)?.originPaymentDetails
      )} which was a ${rows.at(0)?.method} method.`,
    }
  },
  headers: [
    { name: 'Destination payment identifier', columnType: 'ID' },
    { name: 'Payment type', columnType: 'PAYMENT_METHOD' },
    { name: 'Transaction Count', columnType: 'NUMBER' },
    { name: 'Total Amount', columnType: 'MONEY_AMOUNT' },
  ],
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
