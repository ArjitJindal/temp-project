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
import {
  paginatedClickhouseQuery,
  paginatedSqlQuery,
} from '@/services/copilot/questions/definitions/common/pagination'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { getContext } from '@/core/utils/context'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'

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
    let items: [string, string, number, number][] = []
    let total = 0
    let topPaymentIdentifier = ''
    if (isClickhouseEnabled()) {
      const clickhouseClient = await getClickhouseClient(
        getContext()?.tenantId as string
      )
      const query = `
      SELECT
        any(${
          direction === 'ORIGIN'
            ? 'originPaymentMethod'
            : 'destinationPaymentMethod'
        }) as paymentMethod,
        count(*) as count,
        sum(originAmountDetails_amountInUsd) as sum,
        ${
          direction === 'ORIGIN'
            ? 'originPaymentMethodId'
            : 'destinationPaymentMethodId'
        } as paymentIdentifier
      FROM
        transactions FINAL
      WHERE
        ${
          direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
        } = :userId
        and timestamp between :from and :to
      GROUP BY
        ${
          direction === 'ORIGIN'
            ? 'originPaymentMethodId'
            : 'destinationPaymentMethodId'
        }
      ORDER BY
        sum desc
      `

      const { rows, total: resultTotal } = await paginatedClickhouseQuery<{
        paymentIdentifier: string
        paymentMethod: string
        count: number
        sum: number
      }>(
        clickhouseClient,
        query,
        {
          userId,
          ...period,
        },
        page,
        pageSize
      )

      items = rows.map((r) => {
        return [
          r.paymentIdentifier,
          r.paymentMethod,
          r.count,
          convert(r.sum, currency),
        ]
      })

      total = resultTotal
      topPaymentIdentifier = rows.at(0)?.paymentIdentifier ?? ''
    } else {
      const paymentDetailsKey =
        direction === 'ORIGIN'
          ? 'originPaymentDetails'
          : 'destinationPaymentDetails'
      const userIdKey =
        direction === 'ORIGIN' ? 'originUserId' : 'destinationUserId'
      const { rows, total: resultTotal } = await paginatedSqlQuery<{
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

      items = rows
        .filter((r) => !!getPaymentMethodId(r.paymentDetails))
        .map((r) => {
          return [
            getPaymentMethodId(r.paymentDetails) ?? '',
            r.method,
            r.count,
            convert(r.sum, currency),
          ]
        })

      total = resultTotal
      topPaymentIdentifier =
        getPaymentMethodId(rows.at(0)?.paymentDetails) ?? ''
    }

    return {
      data: {
        items,
        total,
      },
      summary: `The top payment identifier used with ${username} as ${direction.toLowerCase()} was ${topPaymentIdentifier} which was a ${
        items.at(0)?.[1]
      } method.`,
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
