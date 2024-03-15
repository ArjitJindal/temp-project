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
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export const UniquePaymentIdentifierSent: TableQuestion<
  Period & { currency: CurrencyCode }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.PAYMENT_IDENTIFIERS_OF_SENDERS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top  payment identifiers they have sent to ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { convert, userId, username },
    { page, pageSize, currency, ...period }
  ) => {
    const { rows, total } = await paginatedSqlQuery<{
      method: string
      count: number
      sum: number
      destinationPaymentDetails: PaymentDetails
    }>(
      `
    select
      first(t.destinationPaymentDetails.method) as method,
      count(*) as count,
      sum(t.transactionAmountUSD) as sum,
      t.destinationPaymentDetails as destinationPaymentDetails
    from
      transactions t
    where
      t.originUserId = :userId
      and t.timestamp between :from and :to
    group by
      t.destinationPaymentDetails
    order by
      count desc
    `,
      {
        userId,
        ...sqlPeriod(period),
      },
      page,
      pageSize
    )

    const items = rows
      .filter((r) => !!getPaymentMethodId(r.destinationPaymentDetails))
      .map((r) => {
        return [
          getPaymentMethodId(r.destinationPaymentDetails),
          r.method,
          r.count,
          convert(r.sum, currency),
        ]
      })

    return {
      data: {
        items,
        total,
      },
      summary: `The top payment identifier that ${username} sent money to was ${getPaymentMethodId(
        rows.at(0)?.destinationPaymentDetails
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
    ...currencyVars,
  },
  defaults: () => {
    return {
      ...periodDefaults(),
      ...currencyDefault,
    }
  },
}
