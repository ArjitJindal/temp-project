import { StackedBarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

export const TransactionType: StackedBarchartQuestion<any> = {
  type: 'STACKED_BARCHART',
  questionId: 'How are the transactions for this user distributed by type?',
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
    return [
      {
        label: '',
        values: results.map((r) => ({ x: r._id, y: r.count })),
      },
    ]
  },
  variableOptions: {},
}
