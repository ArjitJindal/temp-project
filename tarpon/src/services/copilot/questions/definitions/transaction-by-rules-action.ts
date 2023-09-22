import { StackedBarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import {
  humanReadablePeriod,
  dates,
  MONGO_DATE_FORMAT,
  Period,
  periodDefaults,
  periodVars,
  matchPeriod,
} from '@/services/copilot/questions/definitions/util'

export const TransactionByRulesAction: StackedBarchartQuestion<Period> = {
  type: 'STACKED_BARCHART',
  questionId: 'Transactions by rule action',
  title: (_, vars) => {
    return `Transactions by rule action ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async ({ tenantId, userId, username }, period) => {
    const client = await getMongoDbClient()
    const db = client.db()

    const results = await db
      .collection<Case>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<
        { _id: { date: string } } & {
          [key in RuleAction]: number
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
            timestamp: '$timestamp',
            action: '$hitRules.ruleAction',
          },
        },
        {
          $unwind: {
            path: '$action',
          },
        },
        {
          $group: {
            _id: {
              date: '$date',
            },
            ...RULE_ACTIONS.reduce<{ [key in RuleAction]?: any }>(
              (acc, current) => {
                acc[current] = {
                  $sum: {
                    $cond: {
                      if: { $eq: ['$action', current] },
                      then: 1,
                      else: 0,
                    },
                  },
                }
                return acc
              },
              {}
            ),
          },
        },
      ])
      .toArray()

    const countsMap = new Map(results.map((item) => [item._id.date, item]))

    const datesArray = dates(period)
    return {
      data: RULE_ACTIONS.map(
        (ruleAction): { label: string; values: { x: string; y: number }[] } => {
          return {
            label: ruleAction,
            values: datesArray.map((x) => {
              const counts = countsMap.get(x)
              if (counts) {
                return { x, y: counts[ruleAction] }
              }
              return { x, y: 0 }
            }),
          }
        }
      ),
      summary: `There have been ${
        results.length
      } transactions filed for ${username} ${humanReadablePeriod(period)}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return periodDefaults()
  },
}
