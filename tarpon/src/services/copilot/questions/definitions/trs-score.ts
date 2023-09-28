import { TimeseriesQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import {
  dates,
  humanReadablePeriod,
  matchPeriod,
  MONGO_DATE_FORMAT,
  Period,
  periodDefaults,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const TrsScore: TimeseriesQuestion<Period> = {
  type: 'TIME_SERIES',
  questionId: 'TRS score',
  title: async (_, vars) => {
    return `TRS score distribution ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ userId, tenantId }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const results = await db
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
            ...matchPeriod('timestamp', period),
          },
        },
        {
          $project: {
            date: {
              $dateToString: {
                format: MONGO_DATE_FORMAT,
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

    const avgMap = new Map(results.map((item) => [item._id.date, item.avg]))

    return {
      data: [
        {
          label: '',
          values: dates(period).map((d) => {
            return {
              time: new Date(d).valueOf(),
              value: avgMap.get(d) || 0,
            }
          }),
        },
      ],
      summary: `The average TRS score was ${(
        results.reduce((acc, curr) => {
          acc += curr.avg
          return acc
        }, 0) / results.length
      ).toFixed(2)} ${humanReadablePeriod(period)}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
