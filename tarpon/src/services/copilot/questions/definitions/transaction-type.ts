import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { BarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  humanReadablePeriod,
  matchPeriod,
  casePaymentIdentifierQuery,
  Period,
  periodDefaults,
  periodVars,
  paymentIdentifierQueryClickhouse,
  matchPeriodSQL,
} from '@/services/copilot/questions/definitions/util'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { hasFeature } from '@/core/utils/context'
import { getClickhouseClient } from '@/utils/clickhouse/utils'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'

export const TransactionType: BarchartQuestion<Period> = {
  type: 'BARCHART',
  questionId: COPILOT_QUESTIONS.TRANSACTIONS_BY_TYPE,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_, vars) => {
    return `Transactions by type ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    { tenantId, userId, humanReadableId, paymentIdentifier },
    period
  ) => {
    const getClickhouseResults = async (): Promise<
      { type: InternalTransaction['type']; count: number }[]
    > => {
      const clickhouseClient = await getClickhouseClient(tenantId)
      const identifierQuery = userId
        ? `originUserId = '${userId}' OR destinationUserId = '${userId}'`
        : paymentIdentifierQueryClickhouse(paymentIdentifier)

      const query = `
      SELECT type, count() as count
      FROM ${CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName} FINAL
      WHERE
      ${matchPeriodSQL('timestamp', period)} AND
      ${identifierQuery}
      GROUP BY type
      SETTINGS output_format_json_quote_64bit_integers = 0
    `

      const results = await clickhouseClient.query({
        query,
        format: 'JSONEachRow',
      })

      return results.json<{
        type: InternalTransaction['type']
        count: number
      }>()
    }

    const getMongoResults = async (): Promise<
      { type: InternalTransaction['type']; count: number }[]
    > => {
      const client = await getMongoDbClient()
      const db = client.db()
      const condition = userId
        ? [{ originUserId: userId }, { destinationUserId: userId }]
        : casePaymentIdentifierQuery(paymentIdentifier)

      return db
        .collection(TRANSACTIONS_COLLECTION(tenantId))
        .aggregate<{ type: InternalTransaction['type']; count: number }>([
          { $match: { $or: condition, ...matchPeriod('timestamp', period) } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
          { $project: { type: '$_id', count: 1, _id: 0 } },
        ])
        .toArray()
    }

    const data = hasFeature('CLICKHOUSE_ENABLED')
      ? await getClickhouseResults()
      : await getMongoResults()

    const totalTransactions = data.reduce((acc, curr) => acc + curr.count, 0)

    return {
      data: data.map((r) => ({ x: r.type, y: r.count })),
      summary: `There have been ${totalTransactions} transactions for ${humanReadableId} ${humanReadablePeriod(
        period
      )}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
