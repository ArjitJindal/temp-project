import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { buildPaymentIdentifierQuery } from './queries/payment-identifier-query'
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
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'

type PaymentIdentifier = {
  paymentIdentifier: string
  paymentMethod: string
  count: number
  sum: number
  names: string[]
}

export const UniquePaymentIdentifier: TableQuestion<
  Period & {
    currency: CurrencyCode
    direction: Direction
  }
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
    { page, pageSize, direction, currency, sortField, sortOrder, ...period }
  ) => {
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    const directionSmall = direction.toLowerCase()

    let orderByClause = 'ORDER BY sum DESC'
    if (sortField && sortOrder) {
      const direction = sortOrder === 'descend' ? 'DESC' : 'ASC'

      const sortFieldMap: Record<string, string> = {
        count: 'count',
        sum: 'sum',
      }

      const actualSortField = sortFieldMap[sortField] || 'sum'
      orderByClause = `ORDER BY ${actualSortField} ${direction}`
    }

    const query = buildPaymentIdentifierQuery(
      directionSmall,
      orderByClause,
      userId,
      period
    )

    let topPaymentIdentifier: PaymentIdentifier | undefined = undefined

    const { rows, total: resultTotal } =
      await paginatedClickhouseQuery<PaymentIdentifier>(
        query,
        { userId, ...period },
        page,
        pageSize
      )

    rows.forEach((row) => {
      // update the payment method when
      // 1. payment method is undefined
      // 2. current payment method is less txn count
      // 3. current payment method have same txn count but less txn amount
      if (
        !topPaymentIdentifier ||
        topPaymentIdentifier.count < row.count ||
        (topPaymentIdentifier.count === row.count &&
          topPaymentIdentifier.sum < row.sum)
      ) {
        topPaymentIdentifier = row
      }
    })

    const items = rows.map((r) => {
      return [
        r.paymentIdentifier,
        r.paymentMethod,
        r.count,
        convert(r.sum, 'USD', currency), // all currency in CH are in USD
        r.names.join(', '),
      ]
    })

    return {
      data: {
        items,
        total: resultTotal,
      },
      summary: !topPaymentIdentifier
        ? `${username} has not transacted with anyone ${humanReadablePeriod(
            period
          )}.`
        : `The top payment identifier used with ${username} as ${direction.toLowerCase()} was ${
            (topPaymentIdentifier as PaymentIdentifier).paymentIdentifier
          } which was a ${
            (topPaymentIdentifier as PaymentIdentifier).paymentMethod
          } method ${humanReadablePeriod(period)}.`,
    }
  },
  headers: [
    { name: `Payment identifier`, columnType: 'ID' },
    { name: 'Payment type', columnType: 'PAYMENT_METHOD' },
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
    { name: 'Account names', columnType: 'STRING' },
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
