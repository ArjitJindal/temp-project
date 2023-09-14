import { StackedBarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongodb-definitions'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { RuleAction } from '@/@types/openapi-public/RuleAction'

export const TransactionByRulesAction: StackedBarchartQuestion<any> = {
  type: 'STACKED_BARCHART',
  questionId:
    'How are the transactions for this user distributed by rule action?',
  aggregationPipeline: async ({ tenantId, userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()

    const results = await db
      .collection<Case>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<
        { _id: { datetime: string } } & {
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
          },
        },
        {
          $project: {
            datetime: {
              $dateToString: {
                format: '%Y-%m-%d %H:00',
                date: { $toDate: '$timestamp' },
              },
            },
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
              datetime: '$datetime',
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

    return Object.entries(
      results.reduce<{
        [key: string]: { x: string; y: number }[]
      }>((acc, curr) => {
        RULE_ACTIONS.forEach((action) => {
          const series = acc[action]
          const data = curr[action]
          const x = curr._id.datetime

          if (series && series.length > 0) {
            acc[action]?.push({ x, y: data.valueOf() })
          } else {
            acc[action] = [{ x, y: data.valueOf() }]
          }
        })
        return acc
      }, {})
    ).map(([label, values]) => {
      return { label, values }
    })
  },
  variableOptions: {},
}
