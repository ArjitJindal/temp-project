import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import {
  currencyDefault,
  currencyVars,
  Direction,
  directionDefault,
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { isClickhouseEnabled } from '@/utils/clickhouse/checks'
import { CLICKHOUSE_DEFINITIONS } from '@/constants/clickhouse/definitions'
import { executeClickhouseQuery } from '@/utils/clickhouse/execute'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { logger } from '@/core/logger'

type TransactionByCountryIdentifier = {
  country: string
  userViewCount: number
  counterPartyViewCount: number
  userAmount: number
  counterPartyAmount: number
}

/**
 * Builds a subquery for aggregating transactions by country
 * @param userIdField - Field to match user ID against (originUserId or destinationUserId)
 * @param countryField - Field containing country data
 * @param viewType - 'user' or 'counterparty' to determine which count/amount to populate
 * @param userId - User ID to filter by
 */
const buildCountryAggregationSubquery = (
  userIdField: 'originUserId' | 'destinationUserId',
  countryField: string,
  viewType: 'user' | 'counterparty',
  userId: string
): string => {
  const isUserView = viewType === 'user'
  const amountField = countryField.replace('_country', '_amountInUsd')
  const sumExpression = `SUM(COALESCE(${amountField}, 0))`
  const userAmount = isUserView ? sumExpression : '0'
  const counterpartyAmount = isUserView ? '0' : sumExpression

  return `
    SELECT COALESCE(${countryField}, '-') AS country,
      ${isUserView ? 'COUNT(DISTINCT id)' : '0'} AS userViewCount,
      ${isUserView ? '0' : 'COUNT(DISTINCT id)'} AS counterPartyViewCount,
      ${userAmount} AS userAmount,
      ${counterpartyAmount} AS counterPartyAmount
    FROM (
      SELECT 
        id,
        argMax(${countryField}, updatedAt) AS ${countryField},
        argMax(${amountField}, updatedAt) AS ${amountField}
      FROM transactions
      WHERE ${userIdField} = '${userId}'
      AND timestamp BETWEEN {{ from }} AND {{ to }}
      GROUP BY id
    )
    GROUP BY ${countryField}`
}

export const TransactionsByCountry: TableQuestion<
  Period & {
    currency: CurrencyCode
    direction: Direction | 'ALL'
  }
> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.TRANSACTIONS_BY_COUNTRY,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    const directionText =
      vars.direction === 'ALL'
        ? 'where user is a participant'
        : `where user participated as ${vars.direction.toLowerCase()}`
    return `Transactions by country ${directionText} ${humanReadablePeriod(
      vars
    )}`
  },
  aggregationPipeline: async (
    { convert, userId, username, tenantId },
    { page, pageSize, direction, currency, sortField, sortOrder, ...period }
  ) => {
    if (!isClickhouseEnabled()) {
      throw new Error('Clickhouse is not enabled')
    }

    try {
      const subqueries: string[] = []

      if (direction !== 'DESTINATION') {
        // User acts as origin
        subqueries.push(
          buildCountryAggregationSubquery(
            'originUserId',
            'originAmountDetails_country',
            'user',
            userId
          )
        )
        subqueries.push(
          buildCountryAggregationSubquery(
            'originUserId',
            'destinationAmountDetails_country',
            'counterparty',
            userId
          )
        )
      }

      if (direction !== 'ORIGIN') {
        // User acts as destination
        subqueries.push(
          buildCountryAggregationSubquery(
            'destinationUserId',
            'destinationAmountDetails_country',
            'user',
            userId
          )
        )
        subqueries.push(
          buildCountryAggregationSubquery(
            'destinationUserId',
            'originAmountDetails_country',
            'counterparty',
            userId
          )
        )
      }

      // we will execute all the subquery in a promise
      // we can argue that total row from each subquery will never exceed the count of total countries (always < 300)
      // we can easily combine these result in memory and apply sorting etc
      const results = await Promise.all(
        subqueries.map((query) => {
          return executeClickhouseQuery<TransactionByCountryIdentifier[]>(
            tenantId,
            query,
            Object.fromEntries(
              Object.entries({ userId, ...period }).map(([key, value]) => [
                key,
                String(value),
              ])
            )
          )
        })
      )

      const transactionByCountry: {
        [country: string]: TransactionByCountryIdentifier & { amount: number }
      } = {}

      results.forEach((rows) => {
        rows.forEach((data) => {
          const countryName = data.country ?? '-'
          if (!transactionByCountry[countryName]) {
            transactionByCountry[countryName] = {
              country: countryName,
              userViewCount: 0,
              counterPartyViewCount: 0,
              userAmount: 0,
              counterPartyAmount: 0,
              amount: 0,
            }
          }

          transactionByCountry[countryName].userViewCount += data.userViewCount
          transactionByCountry[countryName].userAmount += data.userAmount
          transactionByCountry[countryName].counterPartyViewCount +=
            data.counterPartyViewCount
          transactionByCountry[countryName].counterPartyAmount +=
            data.counterPartyAmount
          transactionByCountry[countryName].amount +=
            data.userAmount + data.counterPartyAmount
        })
      })

      const rows = Object.keys(transactionByCountry).map(
        (countryName) => transactionByCountry[countryName]
      )

      rows.sort((a, b) => {
        const factor = sortOrder === 'ascend' ? 1 : -1
        const val1 = a[`${sortField}`]
        const val2 = b[`${sortField}`]

        return (val1 - val2) * factor
      })

      const countQuery = `
        SELECT COUNT(DISTINCT(id)) as total FROM ${
          CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName
        } WHERE 
        (
          ${
            direction === 'ALL'
              ? `originUserId = '${userId}' OR destinationUserId = '${userId}'`
              : direction === 'ORIGIN'
              ? `originUserId = '${userId}'`
              : `destinationUserId = '${userId}'`
          }
        )
        AND
        timestamp BETWEEN {{ from }} AND {{ to }}
    `
      const totalCount = await executeClickhouseQuery<{ total: number }[]>(
        tenantId,
        countQuery,
        Object.fromEntries(
          Object.entries({ userId, ...period }).map(([key, value]) => [
            key,
            String(value),
          ])
        )
      )

      const transactionsCount = totalCount[0].total

      const ps = pageSize ?? DEFAULT_PAGE_SIZE
      const pn = page ? page - 1 : 0
      const slicedRow = rows.slice(ps * pn, ps * pn + ps)
      const items = slicedRow.map((r) => {
        const userAmount = convert(r.userAmount, 'USD', currency) // amounts are stored in USD in CH
        const counterPartyAmount = convert(
          r.counterPartyAmount,
          'USD',
          currency
        )
        return [
          r.country.length > 0 ? r.country : '-',
          r.userViewCount,
          userAmount,
          r.counterPartyViewCount,
          counterPartyAmount,
        ]
      })

      const topCountry = items.length > 0 ? items[0] : null

      const getDirectionText = () => {
        if (direction === 'ALL') {
          return 'origin and destination'
        }
        return direction.toLowerCase()
      }

      const getSummary = () => {
        if (items.length === 0) {
          return `No transactions found for user ${username} as ${getDirectionText()} ${humanReadablePeriod(
            period
          )}`
        }

        if (!topCountry) {
          return `No transaction data available for ${username}.`
        }

        const countryName = topCountry[0] ?? 'Unnamed Country'
        const userTransactionCount = topCountry[1]
        const userTotalAmount = topCountry[2]
        const counterPartyTransactionCount = topCountry[3]
        const counterPartyTotalAmount = topCountry[4]

        return `The top counterparty country when ${username} acts as ${getDirectionText()} is ${countryName} with ${userTransactionCount} transactions totaling ${userTotalAmount} ${currency} on the user side, and ${counterPartyTransactionCount} transactions totaling ${counterPartyTotalAmount} ${currency} on the counterparty side ${humanReadablePeriod(
          period
        )}.`
      }

      return {
        data: {
          items,
          total: rows.length,
          transactionsCount,
        },
        summary: getSummary(),
      }
    } catch (e) {
      logger.error(
        `Failed to aggregate data for transaction by country ${e}`,
        e
      )
      throw new Error(
        'Query failed to aggreate data for Transaction by country'
      )
    }
  },
  headers: [
    {
      name: `Country`,
      columnType: 'COUNTRY',
      columnId: 'id',
    },
    {
      name: 'Transaction count (user)',
      columnType: 'NUMBER',
      columnId: 'userViewCount',
      sortable: true,
    },
    {
      name: 'Total amount (user)',
      columnType: 'MONEY_AMOUNT',
      columnId: 'userAmount',
      sortable: true,
    },
    {
      name: 'Transaction count (counterparty)',
      columnType: 'NUMBER',
      columnId: 'counterPartyViewCount',
      sortable: true,
    },
    {
      name: 'Total amount (counterparty)',
      columnType: 'MONEY_AMOUNT',
      columnId: 'counterPartyAmount',
      sortable: true,
    },
  ],
  variableOptions: {
    ...periodVars,
    ...currencyVars,
    direction: {
      type: 'AUTOCOMPLETE',
      options: () => ['ALL', 'ORIGIN', 'DESTINATION'],
    },
  },
  defaults: () => {
    return {
      ...periodDefaults(),
      ...currencyDefault,
      ...directionDefault,
    }
  },
}
