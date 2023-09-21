import { BarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  humanReadablePeriod,
  matchPeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const TransactionType: BarchartQuestion<Period> = {
  type: 'BARCHART',
  questionId: 'Transactions by type',
  title: (_, vars) => {
    return `Transactions by type ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const results = await db
      .collection<Case>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate([
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
    return { data: results.map((r) => ({ x: r._id, y: r.count })), summary: '' }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
