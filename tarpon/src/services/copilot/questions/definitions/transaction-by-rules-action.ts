import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { StackedBarchartQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongo-table-names'
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
  casePaymentIdentifierQuery,
} from '@/services/copilot/questions/definitions/util'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'

export const TransactionByRulesAction: StackedBarchartQuestion<Period> = {
  type: 'STACKED_BARCHART',
  questionId: COPILOT_QUESTIONS.TRANSACTIONS_BY_RULE_ACTION,
  categories: ['CONSUMER', 'BUSINESS', 'PAYMENT'],
  title: async (_, vars) => {
    return `Transactions by rule action ${humanReadablePeriod(vars)}`
  },
  aggregationPipeline: async (
    { tenantId, userId, paymentIdentifier, humanReadableId },
    period
  ) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const condition = userId
      ? [{ originUserId: userId }, { destinationUserId: userId }]
      : casePaymentIdentifierQuery(paymentIdentifier)

    const results = await db
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .aggregate<
        { _id: { date: string } } & {
          [key in RuleAction]: number
        }
      >([
        {
          $match: {
            $or: condition,
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
      } transactions processed for ${humanReadableId} ${humanReadablePeriod(
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
