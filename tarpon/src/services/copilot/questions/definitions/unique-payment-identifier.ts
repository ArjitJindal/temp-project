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
  names: string[]
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
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    const directionSmall = direction.toLowerCase()

    const query = `
    SELECT
      any(${directionSmall}PaymentMethod) AS paymentMethod,
      count(*) AS count,
      sum(originAmountDetails_amountInUsd) AS sum,
      ${directionSmall}PaymentMethodId AS paymentIdentifier,
      arrayDistinct(
        arrayFilter(x -> x != '', arrayFlatten(groupArray(names)))
      ) AS names
    FROM (
      SELECT
        ${directionSmall}PaymentMethodId,
        ${directionSmall}PaymentMethod,
        originAmountDetails_amountInUsd,
        CASE
          WHEN ${directionSmall}PaymentMethod = 'CARD' THEN trimBoth(replaceRegexpAll(CONCAT(
            JSONExtractString(data, '${directionSmall}PaymentDetails', 'nameOnCard', 'firstName'),
            ' ',
            JSONExtractString(data, '${directionSmall}PaymentDetails', 'nameOnCard', 'middleName'),
            ' ',
            JSONExtractString(data, '${directionSmall}PaymentDetails', 'nameOnCard', 'lastName')
          ),
          '\\s+',
          ' '
        ))
          WHEN ${directionSmall}PaymentMethod = 'NPP' THEN trimBoth(replaceRegexpAll(CONCAT(
            JSONExtractString(data, '${directionSmall}PaymentDetails', 'name', 'firstName'),
            ' ',
            JSONExtractString(data, '${directionSmall}PaymentDetails', 'name', 'middleName'),
            ' ',
            JSONExtractString(data, '${directionSmall}PaymentDetails', 'name', 'lastName')
          ),
          '\\s+',
          ' '
        ))
          ELSE trimBoth(JSONExtractString(data, '${directionSmall}PaymentDetails', 'name'))
        END AS names
      FROM transactions FINAL
      WHERE
        ${directionSmall}UserId = '{{ userId }}'
        AND timestamp BETWEEN {{ from }} AND {{ to }}
    ) AS pre_aggregated
    GROUP BY ${directionSmall}PaymentMethodId
    ORDER BY sum DESC
`

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

    return {
      data: {
        items: rows.map((r) => {
          return [
            r.paymentIdentifier,
            r.paymentMethod,
            r.count,
            convert(r.sum, currency),
            r.names.join(', '),
          ]
        }),
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
    { name: 'Transaction Count', columnType: 'NUMBER' },
    { name: 'Total Amount', columnType: 'MONEY_AMOUNT' },
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
