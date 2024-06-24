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
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { getPaymentMethodId } from '@/core/dynamodb/dynamodb-keys'
import { paginatedSqlQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

export const UniquePaymentIdentifier: TableQuestion<
  Period & { currency: CurrencyCode; direction: Direction }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.PAYMENT_IDENTIFIERS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top payment identifiers transacted with as ${vars.direction.toLowerCase()} from ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { convert, userId, username },
    { page, pageSize, direction, currency, ...period }
  ) => {
    const paymentDetailsKey =
      direction === 'ORIGIN'
        ? 'originPaymentDetails'
        : 'destinationPaymentDetails'
    const userIdKey =
      direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
    const { rows, total } = await paginatedSqlQuery<{
      method: string
      count: number
      sum: number
      paymentDetails: PaymentDetails
    }>(
      `
    select
      any_value(t.${paymentDetailsKey}.method) as method,
      count(*) as count,
      sum(t.transactionAmountUSD) as sum,
      t.${paymentDetailsKey} as paymentDetails
    from
      transactions t
    where
      t.${userIdKey} = :userId
      and t.timestamp between :from and :to
    group by
      t.${paymentDetailsKey}
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

    const items = rows
      .filter((r) => !!getPaymentMethodId(r.paymentDetails))
      .map((r) => {
        return [
          getPaymentMethodId(r.paymentDetails),
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
      summary: `The top payment identifier used with ${username} as ${direction.toLowerCase()} was ${getPaymentMethodId(
        rows.at(0)?.paymentDetails
      )} which was a ${rows.at(0)?.method} method.`,
    }
  },
  headers: [
    { name: `Payment identifier`, columnType: 'ID' },
    { name: 'Payment type', columnType: 'PAYMENT_METHOD' },
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
