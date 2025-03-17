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
import { paginatedClickhouseQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'

type PaymentIdentifier = {
  paymentIdentifier: string
  paymentMethod: string
  count: number
  sum: number
}

export const UniquePaymentIdentifier: TableQuestion<
  Period & { currency: CurrencyCode; direction: Direction }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.PAYMENT_IDENTIFIERS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top payment identifiers transacted with as ${vars.direction.toLowerCase()} ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { convert, userId, username },
    { page, pageSize, direction, currency, ...period }
  ) => {
    const items: [string, string, number, number][] = []
    const topPaymentIdentifier = ''
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    const directionSmall = direction.toLowerCase()

    const query = `
      SELECT
        any(${directionSmall}PaymentMethod) as paymentMethod,
        count(*) as count,
        sum(originAmountDetails_amountInUsd) as sum,
        ${directionSmall}PaymentMethodId as paymentIdentifier
      FROM
        transactions FINAL
      WHERE
        ${directionSmall}UserId = '{{ userId }}'
        and timestamp between {{ from }} and {{ to }}
      GROUP BY
        ${directionSmall}PaymentMethodId
      ORDER BY
        sum desc
      `

    const { rows, total: resultTotal } =
      await paginatedClickhouseQuery<PaymentIdentifier>(
        query,
        { userId, ...period },
        page,
        pageSize
      )

    return {
      data: {
        items: rows.map((r) => {
          return [
            r.paymentIdentifier,
            r.paymentMethod,
            r.count,
            convert(r.sum, currency),
          ]
        }),
        total: resultTotal,
      },
      summary:
        items.length === 0
          ? `${username} has not transacted with anyone ${humanReadablePeriod(
              period
            )}.`
          : `The top payment identifier used with ${username} as ${direction.toLowerCase()} was ${topPaymentIdentifier} which was a ${
              items.at(0)?.[1]
            } method ${humanReadablePeriod(period)}.`,
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
