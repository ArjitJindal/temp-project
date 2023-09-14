import { TimeseriesQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'

export const TrsScore: TimeseriesQuestion<{
  startTimestamp?: number
}> = {
  type: 'TIME_SERIES',
  questionId: 'How has the TRS score changed over the last week?',
  aggregationPipeline: async ({ userId, tenantId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    return [
      {
        label: '',
        values: (
          await db
            .collection<Case>(TRANSACTIONS_COLLECTION(tenantId))
            .aggregate<
              { _id: { date: string } } & {
                avg: number
              }
            >([
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
                $project: {
                  date: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: { $toDate: '$timestamp' },
                    },
                  },
                  score: '$arsScore.arsScore',
                },
              },
              {
                $group: {
                  _id: {
                    date: '$date',
                  },
                  avg: {
                    $avg: '$score',
                  },
                },
              },
            ])
            .toArray()
        ).map((r) => ({
          time: new Date(r._id.date).valueOf(),
          value: r.avg,
        })),
      },
    ]
  },
  variableOptions: {
    startTimestamp: 'TIMESTAMP',
  },
}
