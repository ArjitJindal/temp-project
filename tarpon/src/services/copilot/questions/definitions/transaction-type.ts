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
} from '@/services/copilot/questions/definitions/util'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

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
    const client = await getMongoDbClient()
    const db = client.db()
    const condition = userId
      ? [{ originUserId: userId }, { destinationUserId: userId }]
      : casePaymentIdentifierQuery(paymentIdentifier)
    const results = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $or: condition,
            ...matchPeriod('timestamp', period),
          },
        },
        {
          $group: {
            _id: '$type',
            count: {
              $sum: 1,
            },
          },
        },
      ])
      .toArray()
    return {
      data: results.map((r) => ({ x: r._id, y: r.count })),
      summary: `There have been ${results.reduce((acc, curr) => {
        acc += curr.count
        return acc
      }, 0)} transactions for ${humanReadableId} ${humanReadablePeriod(
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
