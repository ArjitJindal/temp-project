import { BarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  humanReadablePeriod,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const TransactionType: BarchartQuestion<Period> = {
  type: 'BARCHART',
  questionId: 'How are the transactions for this user distributed by type?',
  title: (vars) => {
    return `Transactions by type for ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId }) => {
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
    return results.map((r) => ({ x: r._id, y: r.count }))
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
