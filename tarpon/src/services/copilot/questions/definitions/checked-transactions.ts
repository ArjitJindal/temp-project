import sortBy from 'lodash/sortBy'
import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { TRANSACTIONS_COLLECTION } from '@/utils/mongo-table-names'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  matchPeriod,
  Period,
  periodVars,
} from '@/services/copilot/questions/definitions/util'

export const CheckedTransactions: TableQuestion<Period> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.CHECKED_TRANSACTIONS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (ctx) => {
    return `Checked transactions that led to "${ctx.alert.ruleName}" rule hit`
  },
  headers: [
    {
      name: 'ID',
      columnType: 'STRING',
    },
    {
      name: 'Amount',
      columnType: 'NUMBER',
    },
    {
      name: 'Timestamp',
      columnType: 'DATE_TIME',
    },
  ],
  aggregationPipeline: async (
    { tenantId, userId, alert, username },
    period
  ) => {
    const client = await getMongoDbClient()

    const checkedTransactions = await client
      .db()
      .collection<InternalTransaction>(TRANSACTIONS_COLLECTION(tenantId))
      .find({
        $and: [
          {
            originUserId: alert.ruleHitMeta?.hitDirections?.includes('ORIGIN')
              ? userId
              : { $exists: true },
          },
          {
            destinationUserId: alert.ruleHitMeta?.hitDirections?.includes(
              'DESTINATION'
            )
              ? userId
              : { $exists: true },
          },
        ],
        executedRules: { $elemMatch: { ruleInstanceId: alert.ruleInstanceId } },
        createdAt: {
          $lt: alert.createdTimestamp,
        },
        ...matchPeriod('createdAt', period),
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const items = sortBy(checkedTransactions, 'timestamp')
      .reverse()
      .map((t) => {
        return [
          t.transactionId,
          `${t.originAmountDetails?.transactionAmount}`,
          t.timestamp,
        ]
      })
    return {
      data: {
        items,
        total: items.length,
      },
      summary: `${checkedTransactions.length} transactions were checked before the alert was created for ${username}.`,
    }
  },
  variableOptions: {
    ...periodVars,
  },
  defaults: () => {
    return {}
  },
}
