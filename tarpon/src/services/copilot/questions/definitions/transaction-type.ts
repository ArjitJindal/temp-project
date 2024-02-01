import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { BarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export const TransactionType: BarchartQuestion<Period> = {
  type: 'BARCHART',
  questionId: COPILOT_QUESTIONS.TRANSACTIONS_BY_TYPE,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, vars) => {
    return `Transactions by type ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId, username }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const results = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            $or: [
              {
                originUserId: userId,
              },
              {
                destinationUserId: userId,
              },
            ],
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
      }, 0)} transactions for ${username} ${humanReadablePeriod(period)}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
