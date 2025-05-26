import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '../types'
import {
  Direction,
  Period,
  currencyDefault,
  currencyVars,
  directionDefault,
  directionVars,
  humanReadablePeriod,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'
import { isClickhouseEnabled } from '@/utils/clickhouse/utils'
import { paginatedClickhouseQuery } from '@/services/copilot/questions/definitions/common/pagination'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

type MerchantIdentifier = {
  merchantName: string
  paymentMethod: string
  count: number
  sum: number
}

export const CardMerchantIdentifier: TableQuestion<
  Period & { currency: CurrencyCode; direction: Direction }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.CARD_MERCHANT_IDENTIFIERS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Top card merchant identifiers transacted with as ${vars.direction.toLowerCase()} ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { convert, userId, username },
    { page, pageSize, direction, currency, ...period }
  ) => {
    const items: [string, string, number, number][] = []

    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }
    const topMerchantName = ''

    const directionSmall = direction.toLowerCase()
    const oppositeDirectionSmall =
      directionSmall === 'origin' ? 'destination' : 'origin'

    const query = `
      SELECT
        JSONExtractString(data, '${oppositeDirectionSmall}PaymentDetails', 'merchantDetails', 'name') as merchantName,
        count(*) as count,
        sum(${directionSmall}AmountDetails_amountInUsd) as sum
      FROM
        transactions FINAL
      WHERE
        ${directionSmall}UserId = '{{ userId }}'
        AND (${oppositeDirectionSmall}UserId = 'null' OR ${oppositeDirectionSmall}UserId IS NULL OR ${oppositeDirectionSmall}UserId = '')
        AND ${oppositeDirectionSmall}PaymentMethod = 'CARD'
        AND timestamp between {{ from }} and {{ to }}
      GROUP BY
        merchantName
      `

    const { rows, total: resultTotal } =
      await paginatedClickhouseQuery<MerchantIdentifier>(
        query,
        { userId, ...period },
        page,
        pageSize
      )

    return {
      data: {
        items: rows.map((r) => {
          return [r.merchantName, 'CARD', r.count, convert(r.sum, currency)]
        }),
        total: resultTotal,
      },
      summary:
        items.length === 0
          ? `${username} has not transacted with counterparty. `
          : `The top counterparty merchant having card payment indentifier transacted with ${username} as ${direction.toLowerCase()} was ${topMerchantName} which was a ${
              items.at(0)?.[1]
            }.`,
    }
  },
  headers: [
    { name: `Merchant name`, columnType: 'MERCHANT_NAME' },
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
